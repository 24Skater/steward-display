/**
 * The SSO rules' own tests, vendored alongside the module.
 *
 * They travel with the code rather than staying behind in the platform
 * repository, because a rule nobody can test is a rule nobody can safely
 * change — and this repository has to stand on its own.
 */

import { describe, expect, it } from "vitest";
import {
  decideSsoSignIn,
  hasVerifiedEmail,
  isLocalPasswordLoginAllowed,
  isSsoConfigured,
  ssoButtonLabel,
  ssoConfig,
} from "./sso";

const CONFIGURED = {
  AUTH0_ISSUER: "https://steward.example.auth0.com",
  AUTH0_CLIENT_ID: "cid",
  AUTH0_CLIENT_SECRET: "secret",
};

describe("reading the SSO configuration", () => {
  it("is absent, not broken, when nothing is configured", () => {
    // A church running VBS on its own server has never heard of the hosted
    // platform. Absent configuration must not become a startup error.
    expect(ssoConfig({})).toBeNull();
    expect(isSsoConfigured({})).toBe(false);
  });

  it("reads all three values together", () => {
    expect(ssoConfig(CONFIGURED)).toEqual({
      issuer: "https://steward.example.auth0.com",
      clientId: "cid",
      clientSecret: "secret",
    });
  });

  it("refuses a half-configured provider rather than offering a broken button", () => {
    for (const missing of ["AUTH0_ISSUER", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET"]) {
      const partial: Record<string, string | undefined> = { ...CONFIGURED };
      delete partial[missing];
      expect(ssoConfig(partial), missing).toBeNull();
    }
  });

  it("treats blank as unset", () => {
    expect(ssoConfig({ ...CONFIGURED, AUTH0_CLIENT_SECRET: "   " })).toBeNull();
  });

  it("strips a trailing slash from the issuer", () => {
    expect(ssoConfig({ ...CONFIGURED, AUTH0_ISSUER: "https://x.example.com/" })?.issuer).toBe(
      "https://x.example.com",
    );
  });

  it("has a label a church can read, and lets it be overridden", () => {
    expect(ssoButtonLabel({})).toBe("Continue with Steward ID");
    expect(ssoButtonLabel({ AUTH0_BUTTON_LABEL: "Sign in with Grace Chapel" })).toBe(
      "Sign in with Grace Chapel",
    );
  });
});

describe("keeping email and password available", () => {
  it("is on unless somebody deliberately turns it off", () => {
    // The default has to be on. A default that removed the sign-in people
    // already use would strand whoever had not moved to SSO yet.
    expect(isLocalPasswordLoginAllowed({})).toBe(true);
    expect(isLocalPasswordLoginAllowed({ ALLOW_LOCAL_PASSWORD_LOGIN: "true" })).toBe(true);
    expect(isLocalPasswordLoginAllowed({ ALLOW_LOCAL_PASSWORD_LOGIN: "" })).toBe(true);
  });

  it("takes only an explicit false", () => {
    expect(isLocalPasswordLoginAllowed({ ALLOW_LOCAL_PASSWORD_LOGIN: "false" })).toBe(false);
    expect(isLocalPasswordLoginAllowed({ ALLOW_LOCAL_PASSWORD_LOGIN: "FALSE" })).toBe(false);
  });

  it("does not read a typo as off", () => {
    // "no", "0" and "off" are all somebody meaning false, but guessing which
    // strings mean false is how a sign-in method disappears by accident.
    expect(isLocalPasswordLoginAllowed({ ALLOW_LOCAL_PASSWORD_LOGIN: "no" })).toBe(true);
    expect(isLocalPasswordLoginAllowed({ ALLOW_LOCAL_PASSWORD_LOGIN: "0" })).toBe(true);
  });
});

describe("deciding whether an SSO sign-in may proceed", () => {
  it("accepts a verified address", () => {
    expect(decideSsoSignIn({ email: "pastor@example.org", email_verified: true }).ok).toBe(true);
  });

  it("accepts the string form of the claim", () => {
    // Database connections send a boolean; some enterprise connections send
    // "true". Reading the string as falsy would lock out exactly the customers
    // most likely to be paying.
    expect(decideSsoSignIn({ email: "pastor@example.org", email_verified: "true" }).ok).toBe(true);
  });

  it("refuses an unverified address", () => {
    // This is the whole security argument for account linking. Without it,
    // asserting an address at the identity provider takes over the account
    // that already owns it here.
    const decision = decideSsoSignIn({ email: "pastor@example.org", email_verified: false });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toContain("not verified");
  });

  it("refuses a missing verification claim rather than assuming the best", () => {
    expect(decideSsoSignIn({ email: "pastor@example.org" }).ok).toBe(false);
  });

  it("refuses a profile with no address at all", () => {
    expect(decideSsoSignIn({ email_verified: true }).ok).toBe(false);
    expect(decideSsoSignIn(null).ok).toBe(false);
    expect(decideSsoSignIn(undefined).ok).toBe(false);
  });

  it("refuses the string 'false', which is not the same as absent", () => {
    expect(hasVerifiedEmail({ email: "a@example.org", email_verified: "false" })).toBe(false);
  });
});
