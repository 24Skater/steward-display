import { describe, expect, it } from "vitest";

import { requiresWriteEntitlement } from "./write-policy";

describe("requiresWriteEntitlement", () => {
  it("never gates a read", () => {
    expect(requiresWriteEntitlement("Screen", "findMany", {})).toBe(false);
    expect(requiresWriteEntitlement("Screen", "count", {})).toBe(false);
  });

  it.each(["create", "update", "upsert", "delete", "deleteMany", "createMany"])(
    "gates %s on church content",
    (operation) => {
      expect(requiresWriteEntitlement("Screen", operation, { data: { name: "x" } })).toBe(true);
    },
  );

  it("gates renaming the church", () => {
    expect(requiresWriteEntitlement("Org", "update", { data: { name: "New" } })).toBe(true);
  });

  it("lets a lapsed church sign in and out", () => {
    // A session row is how signing in works. Refusing it would make READ_ONLY
    // indistinguishable from REVOKED.
    expect(requiresWriteEntitlement("Session", "create", { data: {} })).toBe(false);
    expect(requiresWriteEntitlement("Session", "deleteMany", {})).toBe(false);
  });

  it("lets a person manage their own account", () => {
    expect(requiresWriteEntitlement("User", "update", { data: { passwordHash: "x" } })).toBe(false);
    expect(requiresWriteEntitlement("UserToken", "create", { data: {} })).toBe(false);
  });

  it("lets a paired TV record that it is still there", () => {
    expect(requiresWriteEntitlement("Device", "update", { data: { lastSeenAt: new Date() } })).toBe(
      false,
    );
  });

  it("gates any other change to a device", () => {
    expect(
      requiresWriteEntitlement("Device", "update", {
        data: { lastSeenAt: new Date(), screenId: "s" },
      }),
    ).toBe(true);
    expect(requiresWriteEntitlement("Device", "updateMany", { data: { name: "Lobby" } })).toBe(
      true,
    );
    expect(requiresWriteEntitlement("Device", "deleteMany", {})).toBe(true);
  });
});
