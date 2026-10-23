import { describe, it, expect } from "vitest";
import { isPlatformRequest } from "./service-token";

const TOKEN = "stw_svc_display_s3cret-value-here";
const env = { PLATFORM_SERVICE_TOKEN: TOKEN };

describe("accepting the console", () => {
  it("accepts this app’s own token", () => {
    expect(isPlatformRequest(`Bearer ${TOKEN}`, env)).toBe(true);
  });

  it("accepts a lowercase scheme", () => {
    expect(isPlatformRequest(`bearer ${TOKEN}`, env)).toBe(true);
  });
});

describe("refusing everything else", () => {
  it("refuses another product’s token", () => {
    // The whole point of one token per app: a leak from Table must not be able
    // to provision or read anything here.
    expect(isPlatformRequest("Bearer stw_svc_table_s3cret-value-here", env)).toBe(false);
  });

  it("refuses a token that is merely a prefix of the real one", () => {
    expect(isPlatformRequest("Bearer stw_svc_display_s3cret", env)).toBe(false);
  });

  it("refuses a missing header", () => {
    expect(isPlatformRequest(null, env)).toBe(false);
  });

  it("refuses a bare token with no scheme", () => {
    expect(isPlatformRequest(TOKEN, env)).toBe(false);
  });

  it("refuses the wrong scheme", () => {
    expect(isPlatformRequest(`Basic ${TOKEN}`, env)).toBe(false);
  });
});

describe("when the app is not configured for the platform", () => {
  it("refuses rather than accepting anything", () => {
    // A self-hosted install has no service token. It should refuse platform
    // calls, not accept them — and not crash on them either.
    expect(isPlatformRequest(`Bearer ${TOKEN}`, {})).toBe(false);
  });

  it("refuses a token configured without the expected prefix", () => {
    expect(isPlatformRequest("Bearer nonsense", { PLATFORM_SERVICE_TOKEN: "nonsense" })).toBe(
      false,
    );
  });
});
