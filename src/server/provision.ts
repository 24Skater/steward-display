import { z } from "zod";

import { bypass, db } from "./db";
import { claimUnprovenAccount } from "./account-claim";
import { clearOrgCache, isHosted } from "./org-resolver";
import { isValidSlug } from "./platform-domain";
import { isPlatformRequest } from "./platform/service-token";

/**
 * POST /api/internal/provision
 *
 * Called by the Steward console when a church signs up for Display. It creates
 * this app's tenant root, and makes the person who signed up its owner, and
 * nothing else: the console owns identity, billing and entitlements, and this
 * app owns its own schema. Ported from Congregation's `routes/internal.ts`.
 *
 * Properties the console depends on:
 *
 * 1. **`Org.id` is the console's `orgId`.** Not a mapping table: the same
 *    value. One church has one id across every Steward app, minted by the
 *    console.
 * 2. **Idempotent by `orgId`.** The console retries with backoff, so a second
 *    call for a church that already exists succeeds and changes nothing about
 *    the church. A retry must not rename a church that has since renamed
 *    itself.
 * 3. **4xx means "do not retry".** The console fails fast on any 4xx but 429,
 *    so a permanent problem (a taken slug) reaches an operator instead of
 *    burning the retry budget.
 *
 * Handled in `src/server.ts` before the hostname decides the church, because
 * the church does not exist yet. No DNS or certificate work happens here: the
 * wildcard record and certificate already resolve
 * `{slug}-stewarddisplay.app.<root>`.
 */

const provisionSchema = z.object({
  orgId: z.string().uuid(),
  slug: z.string().min(2).max(31),
  organizationName: z.string().trim().min(1).max(200),
  ownerEmail: z.string().email().optional(),
});

type Body = { state: "ready"; orgId: string; created: boolean } | ProvisionFailure;
type ProvisionFailure = { state: "failed"; error: string; detail?: string };

function json(body: Body, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * The person who signed up becomes the church's owner.
 *
 * Display creates no accounts at sign-in: people join by invitation, and a
 * provisioned church has nobody to invite them. So the owner's account is made
 * here, with no password, and their first Steward ID sign-in binds to it. That
 * sign-in requires a verified email (`sso-flow.ts`), which is what makes an
 * email from the console enough to go on. An existing account with that email
 * is reused: one person, one account, however many churches. The console has
 * proven the address, so an account nobody had proven it for is handed over
 * clean (`account-claim.ts`).
 */
async function grantOwner(orgId: string, email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  // The user row is global, and there is no church in context yet.
  const user = await db().user.upsert(
    bypass({
      where: { email: address },
      update: {},
      create: { email: address, name: address.split("@")[0] },
      select: { id: true },
    }),
  );
  await claimUnprovenAccount(user.id);
  await db().membership.create(
    bypass({ data: { orgId, userId: user.id, role: "OWNER" as const } }),
  );
}

export async function handleProvision(request: Request): Promise<Response> {
  if (!isPlatformRequest(request.headers.get("authorization"))) {
    return json({ state: "failed", error: "unauthorized" }, 401);
  }
  // A self-hosted install has one church, made by first-run setup. A second
  // one from here would make every request ambiguous (`org-resolver.ts`).
  if (!isHosted()) return json({ state: "failed", error: "not_hosted" }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ state: "failed", error: "invalid_json" }, 400);
  }

  const parsed = provisionSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { state: "failed", error: "invalid_request", detail: parsed.error.issues[0]?.message },
      400,
    );
  }

  const { orgId, organizationName, ownerEmail } = parsed.data;
  const slug = parsed.data.slug.trim().toLowerCase();
  if (!isValidSlug(slug)) return json({ state: "failed", error: "invalid_slug" }, 400);

  try {
    const existing = await db().org.findUnique(
      bypass({ where: { id: orgId }, select: { id: true } }),
    );
    if (existing) {
      // The first attempt may have died between creating the church and
      // granting it, so a church with nobody in it still gets its owner. One
      // with members is left alone: a retry must not re-promote somebody the
      // church has since demoted or removed.
      const members = await db().membership.count(bypass({ where: { orgId } }));
      if (ownerEmail && members === 0) await grantOwner(orgId, ownerEmail);
      return json({ state: "ready", orgId, created: false }, 200);
    }

    const slugOwner = await db().org.findUnique(bypass({ where: { slug }, select: { id: true } }));
    if (slugOwner) {
      return json(
        { state: "failed", error: "slug_taken", detail: `The slug "${slug}" is already in use.` },
        409,
      );
    }

    await db().org.create(bypass({ data: { id: orgId, slug, name: organizationName } }));
    if (ownerEmail) await grantOwner(orgId, ownerEmail);

    // Only real churches are cached, but a replica that answered "unknown host"
    // a moment ago should not have to think about it.
    clearOrgCache();
    return json({ state: "ready", orgId, created: true }, 201);
  } catch (error) {
    // 500 is retryable, which is right for a database blip.
    console.error("[provision] Failed:", error);
    return json({ state: "failed", error: "internal" }, 500);
  }
}
