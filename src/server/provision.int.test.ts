import { afterEach, beforeEach, expect, it } from "vitest";

import { describeDb, resetDatabase } from "@/test/db";
import { bypass, db } from "./db";
import { linkSsoIdentity } from "./sso-flow";
import { runInOrg } from "./org-context";
import { handleProvision } from "./provision";

const TOKEN = "stw_svc_display_test-secret-0123456789";
const ORG_ID = "6f9b3a52-6a0e-4c4e-9d0b-1f2a3b4c5d6e";

function call(body: unknown, token: string | null = TOKEN): Promise<Response> {
  return handleProvision(
    new Request("http://display.internal/api/internal/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const grace = {
  orgId: ORG_ID,
  slug: "grace",
  organizationName: "Grace Church",
  ownerEmail: "Olive@Grace.org",
};

const PLATFORM_ENV = { PLATFORM_SERVICE_TOKEN: TOKEN, PLATFORM_ROOT_DOMAIN: "steward.test" };
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(Object.keys(PLATFORM_ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, PLATFORM_ENV);
});
afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describeDb("POST /api/internal/provision", () => {
  beforeEach(resetDatabase);

  it("creates the church under the console's id and makes the signer-up its owner", async () => {
    const response = await call(grace);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ state: "ready", orgId: ORG_ID, created: true });

    const org = await db().org.findUnique(bypass({ where: { id: ORG_ID } }));
    expect(org).toMatchObject({ slug: "grace", name: "Grace Church", status: "ACTIVE" });

    const owner = await db().user.findUnique(
      bypass({ where: { email: "olive@grace.org" }, include: { memberships: true } }),
    );
    expect(owner?.passwordHash).toBeNull();
    expect(owner?.memberships).toMatchObject([{ orgId: ORG_ID, role: "OWNER" }]);
  });

  it("lets the owner in with Steward ID, which is the only way they have", async () => {
    await call(grace);
    const claims = { sub: "auth0|olive", email: "olive@grace.org", email_verified: true };
    const result = await runInOrg({ orgId: ORG_ID, slug: "grace", name: "Grace Church" }, () =>
      linkSsoIdentity(claims, "https://id.steward.test/"),
    );
    expect(result.ok).toBe(true);
  });

  it("is idempotent: a retry succeeds and does not rename the church", async () => {
    await call(grace);
    await db().org.update(bypass({ where: { id: ORG_ID }, data: { name: "Grace Fellowship" } }));

    const retry = await call({ ...grace, organizationName: "Grace Church" });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ state: "ready", orgId: ORG_ID, created: false });
    const org = await db().org.findUnique(bypass({ where: { id: ORG_ID } }));
    expect(org?.name).toBe("Grace Fellowship");
    expect(await db().membership.count(bypass({}))).toBe(1);
  });

  it("reuses a proven account: one person, one login, several churches", async () => {
    const existing = await db().user.create(
      bypass({
        data: {
          email: "olive@grace.org",
          name: "Olive",
          passwordHash: "kept",
          emailVerifiedAt: new Date(),
        },
      }),
    );
    await call(grace);
    const user = await db().user.findUnique(bypass({ where: { id: existing.id } }));
    expect(user?.passwordHash).toBe("kept");
    expect(await db().membership.count(bypass({ where: { userId: existing.id } }))).toBe(1);
  });

  it("does not hand the owner an account a stranger set up with their address", async () => {
    // A stranger invites olive@grace.org to a church of their own and accepts
    // the invitation themselves: an unproven account with the stranger's
    // password and sessions. Olive then signs up through the console.
    const strangers = await db().org.create(bypass({ data: { slug: "decoy", name: "Decoy" } }));
    const planted = await db().user.create(
      bypass({ data: { email: "olive@grace.org", name: "Olive", passwordHash: "stranger's" } }),
    );
    await db().membership.create(bypass({ data: { orgId: strangers.id, userId: planted.id } }));
    await db().session.create(
      bypass({
        data: {
          orgId: strangers.id,
          userId: planted.id,
          tokenHash: "stranger-session",
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    );

    await call(grace);

    const user = await db().user.findUnique(bypass({ where: { id: planted.id } }));
    expect(user?.passwordHash).toBeNull();
    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(await db().session.count(bypass({ where: { userId: planted.id } }))).toBe(0);
  });

  it("does not re-promote someone the church has since demoted", async () => {
    await call(grace);
    await db().membership.updateMany(
      bypass({ where: { orgId: ORG_ID }, data: { role: "EDITOR" } }),
    );
    await call(grace);
    const membership = await db().membership.findFirst(bypass({ where: { orgId: ORG_ID } }));
    expect(membership?.role).toBe("EDITOR");
  });

  it("refuses on a self-hosted install, whose one church comes from setup", async () => {
    delete process.env.PLATFORM_ROOT_DOMAIN;
    const response = await call(grace);
    expect(response.status).toBe(404);
    expect(await db().org.count(bypass({}))).toBe(0);
  });

  it("refuses a slug another church holds with 409, which the console does not retry", async () => {
    await call(grace);
    const response = await call({ ...grace, orgId: "0d4f1c2b-9a8e-4b7c-8d6e-5f4a3b2c1d0e" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ state: "failed", error: "slug_taken" });
  });

  it("refuses anyone without this app's service token", async () => {
    expect((await call(grace, null)).status).toBe(401);
    expect((await call(grace, "stw_svc_table_test-secret-0123456789")).status).toBe(401);
    expect(await db().org.count(bypass({}))).toBe(0);
  });

  it("refuses everything when no token is configured", async () => {
    delete process.env.PLATFORM_SERVICE_TOKEN;
    expect((await call(grace)).status).toBe(401);
  });

  it.each([
    ["not JSON", "{", "invalid_json"],
    ["an id that is not a UUID", { ...grace, orgId: "abc" }, "invalid_request"],
    ["a slug with a space", { ...grace, slug: "grace church" }, "invalid_slug"],
    ["no church name", { ...grace, organizationName: " " }, "invalid_request"],
  ])("answers 400 to %s", async (_label, body, error) => {
    const response = await call(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ state: "failed", error });
  });
});
