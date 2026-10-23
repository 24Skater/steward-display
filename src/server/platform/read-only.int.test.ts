import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";
import { bypass, db, READ_ONLY_MESSAGE } from "../db";
import { createSession } from "../sessions";
import type { EntitlementState } from "./entitlement-state";
import { resetPlatformClient } from "./entitlements";

/** A console that answers `state` for Display. */
function platformSaying(state: EntitlementState | undefined) {
  resetPlatformClient({ getState: vi.fn().mockResolvedValue(state) } as never);
}

afterEach(() => resetPlatformClient(undefined));

describeDb("a READ_ONLY church, at the data layer", () => {
  beforeEach(resetDatabase);

  async function church() {
    const org = await makeOrg("Grace");
    const user = await db().user.create(bypass({ data: { email: "o@grace.org", name: "Olive" } }));
    await db().membership.create(bypass({ data: { orgId: org.orgId, userId: user.id } }));
    const device = await db().device.create(
      bypass({ data: { orgId: org.orgId, name: "Lobby", tokenHash: "h" } }),
    );
    return { org, userId: user.id, deviceId: device.id };
  }

  it("cannot change its content", async () => {
    const { org } = await church();
    platformSaying("READ_ONLY");
    await expect(
      asOrg(
        org,
        async () =>
          await db().screen.create({ data: { orgId: org.orgId, name: "x", document: {} } }),
      ),
    ).rejects.toThrow(READ_ONLY_MESSAGE);
    await expect(
      asOrg(
        org,
        async () => await db().org.update({ where: { id: org.orgId }, data: { name: "Renamed" } }),
      ),
    ).rejects.toThrow(READ_ONLY_MESSAGE);
  });

  it("cannot rename itself through the unscoped query settings uses", async () => {
    const { org } = await church();
    platformSaying("READ_ONLY");
    await expect(
      asOrg(
        org,
        async () =>
          await db().org.update(bypass({ where: { id: org.orgId }, data: { name: "Renamed" } })),
      ),
    ).rejects.toThrow(READ_ONLY_MESSAGE);
  });

  it("can still read, sign in, and keep its TVs checking in", async () => {
    const { org, userId, deviceId } = await church();
    platformSaying("READ_ONLY");
    await asOrg(org, async () => {
      expect(await db().screen.count()).toBe(0);
      await createSession(userId, null);
      await db().device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });
    });
  });

  it("writes freely while ACTIVE", async () => {
    const { org } = await church();
    platformSaying("ACTIVE");
    await asOrg(
      org,
      async () => await db().screen.create({ data: { orgId: org.orgId, name: "x", document: {} } }),
    );
  });

  it("writes freely with no console configured, as a self-hosted install does", async () => {
    const { org } = await church();
    resetPlatformClient(null);
    await asOrg(
      org,
      async () => await db().screen.create({ data: { orgId: org.orgId, name: "x", document: {} } }),
    );
  });
});
