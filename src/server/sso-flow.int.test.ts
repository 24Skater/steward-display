import { beforeEach, describe, expect, it } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";
import { bypass, db } from "./db";
import { linkSsoIdentity, readHandoff } from "./sso-flow";

const ISSUER = "https://steward.example.auth0.com/";

async function member(orgId: string, email: string) {
  const user = await db().user.create(bypass({ data: { email, name: "Pat" } }));
  await db().membership.create(bypass({ data: { orgId, userId: user.id } }));
  return user.id;
}

const claims = (email: string, sub = "auth0|pat", verified: unknown = true) =>
  ({ email, email_verified: verified, sub }) as never;

describeDb("linking a Steward ID to an account", () => {
  beforeEach(resetDatabase);

  it("signs in a team member with a verified address, and binds the identity", async () => {
    const grace = await makeOrg("Grace");
    const userId = await member(grace.orgId, "pat@grace.org");
    expect(await asOrg(grace, () => linkSsoIdentity(claims("Pat@Grace.org"), ISSUER))).toEqual({
      ok: true,
      userId,
    });
    const user = await db().user.findUnique({ where: { id: userId } });
    expect(user?.ssoSubject).toBe(`${ISSUER}|auth0|pat`);
  });

  it("refuses an unverified address, or an identity with no subject", async () => {
    const grace = await makeOrg("Grace");
    await member(grace.orgId, "pat@grace.org");
    for (const c of [claims("pat@grace.org", "auth0|pat", false), claims("pat@grace.org", "")]) {
      expect(await asOrg(grace, () => linkSsoIdentity(c, ISSUER))).toEqual({
        ok: false,
        reason: "sso_unverified",
      });
    }
  });

  it("gives the same answer for no account and for an account at another church", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await member(hope.orgId, "pat@hope.org");
    const none = await asOrg(grace, () => linkSsoIdentity(claims("nobody@x.org"), ISSUER));
    const elsewhere = await asOrg(grace, () => linkSsoIdentity(claims("pat@hope.org"), ISSUER));
    expect(none).toEqual({ ok: false, reason: "sso_no_account" });
    expect(elsewhere).toEqual(none);
  });

  it("refuses a different identity claiming a bound address", async () => {
    const grace = await makeOrg("Grace");
    await member(grace.orgId, "pat@grace.org");
    await asOrg(grace, () => linkSsoIdentity(claims("pat@grace.org", "auth0|pat"), ISSUER));
    // Same verified email, another identity: e.g. a connection that vouches for any address.
    expect(
      await asOrg(grace, () => linkSsoIdentity(claims("pat@grace.org", "waad|someone"), ISSUER)),
    ).toEqual({ ok: false, reason: "sso_mismatch" });
    // The bound one still works.
    expect(
      (await asOrg(grace, () => linkSsoIdentity(claims("pat@grace.org", "auth0|pat"), ISSUER))).ok,
    ).toBe(true);
  });
});

describe("readHandoff", () => {
  const value = { verifier: "v", state: "s", nonce: "n", next: "/tvs" };
  const header = (name: string, v: string) => `other=1; ${name}=${v}; last=2`;

  it("reads the cookie this code wrote", () => {
    const cookie = header("__Host-sd_sso", encodeURIComponent(JSON.stringify(value)));
    expect(readHandoff(cookie, "__Host-sd_sso")).toEqual(value);
  });

  it("treats missing, malformed or partial cookies as absent, without throwing", () => {
    expect(readHandoff(null, "__Host-sd_sso")).toBeNull();
    expect(readHandoff(header("__Host-sd_sso", "%E0"), "__Host-sd_sso")).toBeNull();
    expect(readHandoff(header("__Host-sd_sso", "not-json"), "__Host-sd_sso")).toBeNull();
    const partial = encodeURIComponent(JSON.stringify({ ...value, nonce: "" }));
    expect(readHandoff(header("__Host-sd_sso", partial), "__Host-sd_sso")).toBeNull();
    // A cookie under the unprefixed name is not read when the prefixed one is expected.
    const planted = header("sd_sso", encodeURIComponent(JSON.stringify(value)));
    expect(readHandoff(planted, "__Host-sd_sso")).toBeNull();
  });
});
