import { beforeEach, expect, it } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";
import { setUpInstallation, signIn, changePassword } from "./accounts";
import { bypass, db } from "./db";
import {
  deviceForToken,
  listDevices,
  payloadForDevice,
  removeDevice,
  updateDevice,
} from "./devices";
import { hashPassword } from "./password";
import { claimPairing, collectPairing, startPairing } from "./pairing";
import { resolveOrg, clearOrgCache } from "./org-resolver";
import { createScreen, getScreen, importScreens, listScreens, saveScreen } from "./screens";
import { revokeSession, viewerForToken } from "./sessions";
import { getOrgSettings, updateOrgSettings } from "./settings";
import { setupCode } from "./setup-code";

const screenDoc = (name: string) => ({
  name,
  orientation: "landscape",
  resolution: "1920x1080",
  backgroundColor: "#0B1220",
  widgets: [],
});

async function addMember(orgId: string, email: string, password: string) {
  const user = await db().user.create(
    bypass({ data: { email, name: "Pat", passwordHash: await hashPassword(password) } }),
  );
  await db().membership.create(
    bypass({ data: { orgId, userId: user.id, role: "EDITOR" as const } }),
  );
  return user;
}

describeDb("first-run setup", () => {
  beforeEach(async () => {
    await resetDatabase();
    clearOrgCache();
  });

  it("creates the church and its owner once, then refuses", async () => {
    expect((await resolveOrg("anything.local")).kind).toBe("setup");

    await expect(
      setUpInstallation(
        {
          churchName: "Grace",
          name: "Sam",
          email: "s@g.org",
          password: "a long password",
          setupCode: "WRONG",
        },
        "test",
      ),
    ).rejects.toThrow(/setup code/);

    const signedIn = await setUpInstallation(
      {
        churchName: "Grace Church",
        name: "Sam",
        email: "Sam@Grace.org",
        password: "a long password",
        setupCode: setupCode().toLowerCase(),
      },
      "test",
    );
    const resolved = await resolveOrg("anything.local");
    expect(resolved.kind).toBe("org");
    if (resolved.kind !== "org") return;

    const viewer = await asOrg(resolved.org, () => viewerForToken(signedIn.token));
    expect(viewer).toMatchObject({ email: "sam@grace.org", role: "OWNER" });

    await expect(
      setUpInstallation(
        {
          churchName: "Other",
          name: "Eve",
          email: "eve@x.org",
          password: "a long password",
          setupCode: setupCode(),
        },
        "test",
      ),
    ).rejects.toThrow(/already set up/);
  });
});

describeDb("sign-in and sessions", () => {
  beforeEach(resetDatabase);

  it("signs a member in, and refuses a wrong password and a non-member alike", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await addMember(grace.orgId, "pat@grace.org", "right password");

    const session = await asOrg(grace, () =>
      signIn({ email: "pat@grace.org", password: "right password" }, null),
    );
    expect(await asOrg(grace, () => viewerForToken(session.token))).not.toBeNull();

    await expect(
      asOrg(grace, () => signIn({ email: "pat@grace.org", password: "wrong password" }, null)),
    ).rejects.toThrow(/don't match/);
    // A real account, at a church it does not belong to: the same answer.
    await expect(
      asOrg(hope, () => signIn({ email: "pat@grace.org", password: "right password" }, null)),
    ).rejects.toThrow(/don't match/);
  });

  it("does not honour one church's session at another church", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await addMember(grace.orgId, "pat@grace.org", "right password");
    const session = await asOrg(grace, () =>
      signIn({ email: "pat@grace.org", password: "right password" }, null),
    );
    expect(await asOrg(hope, () => viewerForToken(session.token))).toBeNull();
  });

  it("signs out, and a password change signs out every other browser", async () => {
    const grace = await makeOrg();
    const user = await addMember(grace.orgId, "pat@grace.org", "right password");
    const creds = { email: "pat@grace.org", password: "right password" };
    const laptop = await asOrg(grace, () => signIn(creds, null));
    const phone = await asOrg(grace, () => signIn(creds, null));

    const laptopViewer = await asOrg(grace, () => viewerForToken(laptop.token));
    const { signedOut } = await asOrg(grace, () =>
      changePassword(user.id, laptopViewer!.sessionId, {
        currentPassword: "right password",
        newPassword: "a brand new password",
      }),
    );
    expect(signedOut).toBe(1);
    expect(await asOrg(grace, () => viewerForToken(phone.token))).toBeNull();
    expect(await asOrg(grace, () => viewerForToken(laptop.token))).not.toBeNull();

    await asOrg(grace, () => revokeSession(laptop.token));
    expect(await asOrg(grace, () => viewerForToken(laptop.token))).toBeNull();
  });
});

describeDb("church isolation", () => {
  beforeEach(resetDatabase);

  it("never shows, saves or pairs across churches", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    const graceScreen = await asOrg(grace, () => createScreen(screenDoc("Grace lobby")));

    expect(await asOrg(hope, () => listScreens())).toEqual([]);
    expect(await asOrg(hope, () => getScreen(graceScreen.id))).toBeNull();
    expect(
      (await asOrg(hope, () => saveScreen(graceScreen.id, screenDoc("pwned"), 1))).status,
    ).toBe("not-found");
    expect((await asOrg(grace, () => getScreen(graceScreen.id)))?.name).toBe("Grace lobby");

    // A code shown on Grace's TV cannot be claimed from Hope's admin.
    const pairing = await asOrg(grace, () => startPairing());
    await expect(
      asOrg(hope, () => claimPairing({ code: pairing.code, name: "Stolen", screenId: null })),
    ).rejects.toThrow(/isn't waiting/);
    // Nor can Hope assign Grace's screen to one of its own TVs.
    const hopePairing = await asOrg(hope, () => startPairing());
    await expect(
      asOrg(hope, () =>
        claimPairing({ code: hopePairing.code, name: "TV", screenId: graceScreen.id }),
      ),
    ).rejects.toThrow(/no longer exists/);
  });

  it("keeps settings per church", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await asOrg(grace, () => updateOrgSettings({ timezone: "Europe/London" }));
    expect((await asOrg(grace, () => getOrgSettings())).timezone).toBe("Europe/London");
    expect((await asOrg(hope, () => getOrgSettings())).timezone).toBe("America/New_York");
  });
});

describeDb("screens", () => {
  beforeEach(resetDatabase);

  it("saves against the version it was loaded at, and reports a conflict otherwise", async () => {
    const org = await makeOrg();
    const screen = await asOrg(org, () => createScreen(screenDoc("Lobby")));
    expect(screen.version).toBe(1);

    const first = await asOrg(org, () => saveScreen(screen.id, screenDoc("Lobby v2"), 1));
    expect(first).toMatchObject({ status: "saved", screen: { version: 2, name: "Lobby v2" } });

    const stale = await asOrg(org, () => saveScreen(screen.id, screenDoc("Lobby stale"), 1));
    expect(stale).toMatchObject({ status: "conflict", screen: { version: 2, name: "Lobby v2" } });
  });

  it("imports valid screens from a browser and reports the rest", async () => {
    const org = await makeOrg();
    const result = await asOrg(org, () =>
      importScreens([screenDoc("Good"), { ...screenDoc("Bad"), resolution: "8K" }]),
    );
    expect(result.imported).toBe(1);
    expect(result.failed).toEqual([{ name: "Bad", reason: expect.stringContaining("resolution") }]);
  });
});

describeDb("pairing a TV", () => {
  beforeEach(resetDatabase);

  it("goes from code to token to screen, pays out once, and can be revoked", async () => {
    const org = await makeOrg();
    const screen = await asOrg(org, () => createScreen(screenDoc("Lobby")));

    const started = await asOrg(org, () => startPairing());
    expect(await asOrg(org, () => collectPairing(started.pollSecret))).toMatchObject({
      status: "pending",
      code: started.code,
    });

    await asOrg(org, () =>
      claimPairing({ code: started.code.toLowerCase(), name: "Lobby left", screenId: screen.id }),
    );
    const collected = await asOrg(org, () => collectPairing(started.pollSecret));
    expect(collected.status).toBe("paired");
    if (collected.status !== "paired") return;
    // A TV whose answer was lost asks again: it gets a fresh token, and the first one dies.
    const again = await asOrg(org, () => collectPairing(started.pollSecret));
    if (again.status !== "paired") throw new Error("second collect should pair");
    expect(again.deviceToken).not.toBe(collected.deviceToken);
    expect(await asOrg(org, () => deviceForToken(collected.deviceToken))).toBeNull();
    const token = again.deviceToken;

    const device = await asOrg(org, () => deviceForToken(token));
    expect(device).toMatchObject({ name: "Lobby left", screenId: screen.id });

    const before = await asOrg(org, () => payloadForDevice(device!));
    expect(before.payload.screen?.name).toBe("Lobby");
    await asOrg(org, () => saveScreen(screen.id, screenDoc("Lobby edited"), 1));
    const after = await asOrg(org, () => payloadForDevice(device!));
    expect(after.etag).not.toBe(before.etag);

    const [listed] = await asOrg(org, () => listDevices());
    expect(listed).toMatchObject({ name: "Lobby left", online: true, awaitingTv: false });

    await asOrg(org, () => updateDevice(device!.id, { screenId: null }));
    expect(
      (await asOrg(org, () => payloadForDevice({ ...device!, screenId: null }))).payload.screen,
    ).toBeNull();

    await asOrg(org, () => removeDevice(device!.id));
    expect(await asOrg(org, () => deviceForToken(token))).toBeNull();
  });

  it("refuses an expired code", async () => {
    const org = await makeOrg();
    const started = await asOrg(org, () => startPairing(new Date(Date.now() - 11 * 60 * 1000)));
    await expect(
      asOrg(org, () => claimPairing({ code: started.code, name: "TV", screenId: null })),
    ).rejects.toThrow(/isn't waiting/);
    expect(await asOrg(org, () => collectPairing(started.pollSecret))).toEqual({
      status: "expired",
    });
  });
});
