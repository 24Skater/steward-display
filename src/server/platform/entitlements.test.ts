import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkEntitlement, isMutationMethod, resetPlatformClient } from "./entitlements";
import type { EntitlementState } from "./entitlement-state";

const ORG = "org-first-baptist";
const PLATFORM_ENV = { PLATFORM_CONSOLE_URL: "https://console.test", PLATFORM_SERVICE_TOKEN: "x" };

function clientReturning(state: EntitlementState | undefined) {
  return { getState: vi.fn().mockResolvedValue(state) } as never;
}

beforeEach(() => {
  resetPlatformClient(undefined);
});

describe("self-hosted", () => {
  it("allows everything when no console is configured", () => {
    // A church running its own copy owes nobody a subscription, and must not be
    // blocked by a platform it has never heard of.
    resetPlatformClient(null);
    return expect(checkEntitlement(ORG, true, {})).resolves.toMatchObject({ allow: true });
  });
});

describe("on the platform", () => {
  it.each(["ACTIVE", "GRACE"] as const)("%s may write", async (state) => {
    resetPlatformClient(clientReturning(state));
    const decision = await checkEntitlement(ORG, true, PLATFORM_ENV);
    expect(decision).toMatchObject({ allow: true, readOnly: false });
  });

  it("READ_ONLY may read", async () => {
    resetPlatformClient(clientReturning("READ_ONLY"));
    const decision = await checkEntitlement(ORG, false, PLATFORM_ENV);
    expect(decision).toMatchObject({ allow: true, readOnly: true });
  });

  it("READ_ONLY may not write", async () => {
    resetPlatformClient(clientReturning("READ_ONLY"));
    const decision = await checkEntitlement(ORG, true, PLATFORM_ENV);
    expect(decision).toMatchObject({ allow: false, reason: "read_only" });
  });

  it("REVOKED may not even read", async () => {
    // The one state that stops reads. Everything else keeps them, so a lapsed
    // church can still log in and export.
    resetPlatformClient(clientReturning("REVOKED"));
    const decision = await checkEntitlement(ORG, false, PLATFORM_ENV);
    expect(decision).toMatchObject({ allow: false, reason: "revoked" });
  });

  it("a church that never bought Display is not subscribed", async () => {
    resetPlatformClient(clientReturning(undefined));
    const decision = await checkEntitlement(ORG, false, PLATFORM_ENV);
    expect(decision).toMatchObject({ allow: false, reason: "not_subscribed" });
  });
});

describe("when the console cannot be reached", () => {
  it("allows the request rather than locking a church out", async () => {
    // Fail open, deliberately. The client already honours its cache for 24
    // hours and throws only when it has never seen this church at all;
    // refusing here would lock out a church whose first request of the day
    // happened during an outage. A billing problem must never stop a Sunday.
    resetPlatformClient({
      getState: vi.fn().mockRejectedValue(new Error("console unreachable")),
    } as never);

    const decision = await checkEntitlement(ORG, true, PLATFORM_ENV);
    expect(decision).toMatchObject({ allow: true });
  });
});

describe("which HTTP methods change things", () => {
  it.each(["GET", "HEAD", "OPTIONS", "get"])("%s does not", (method) => {
    expect(isMutationMethod(method)).toBe(false);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s does", (method) => {
    expect(isMutationMethod(method)).toBe(true);
  });
});
