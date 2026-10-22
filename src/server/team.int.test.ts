import { beforeEach, expect, it, vi } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";

// Capture outgoing mail instead of sending it.
const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("./mailer", () => ({
  isEmailConfigured: () => true,
  sendEmail: async (email: { to: string; subject: string; text: string }) => {
    sent.push(email);
    return { sent: true };
  },
}));

const { bypass, db } = await import("./db");
const { hashPassword } = await import("./password");
const { signIn } = await import("./accounts");
const { viewerForToken } = await import("./sessions");
const team = await import("./team");
const recovery = await import("./account-recovery");

async function owner(orgId: string, email = "owner@grace.org") {
  const user = await db().user.create(
    bypass({ data: { email, name: "Olive", passwordHash: await hashPassword("owner password!") } }),
  );
  await db().membership.create(
    bypass({ data: { orgId, userId: user.id, role: "OWNER" as const } }),
  );
  return {
    userId: user.id,
    sessionId: "s",
    name: "Olive",
    email,
    role: "OWNER" as const,
    emailVerified: false,
  };
}

const linkIn = (text: string) => text.match(/https?:\/\/\S+/)?.[0] ?? "";
const tokenIn = (text: string) => linkIn(text).split("/").pop() ?? "";

describeDb("team invitations", () => {
  beforeEach(async () => {
    await resetDatabase();
    sent.length = 0;
    process.env.PUBLIC_URL = "https://display.grace.test";
  });

  it("invites by email, and the new person joins with the role and is signed in", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);

    const { link, emailed } = await asOrg(grace, () =>
      team.inviteMember(olive, { email: "Pat@Grace.org", role: "EDITOR" }, "http://ignored"),
    );
    expect(emailed).toBe(true);
    expect(link.startsWith("https://display.grace.test/invite/")).toBe(true);
    expect(sent[0]).toMatchObject({ to: "pat@grace.org" });

    const token = link.split("/").pop()!;
    expect(await asOrg(grace, () => team.describeInvitation(token))).toMatchObject({
      email: "pat@grace.org",
      role: "EDITOR",
      hasAccount: false,
    });

    const session = await asOrg(grace, () =>
      team.acceptInvitation({ token, name: "Pat", password: "pat's long password" }, null),
    );
    expect(await asOrg(grace, () => viewerForToken(session.token))).toMatchObject({
      email: "pat@grace.org",
      role: "EDITOR",
    });
    // Used once.
    await expect(
      asOrg(grace, () =>
        team.acceptInvitation({ token, name: "Eve", password: "another password" }, null),
      ),
    ).rejects.toThrow(/expired or was already used/);
  });

  it("lets someone from another church join with the password they already have", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await owner(hope.orgId, "pat@hope.org");
    const olive = await owner(grace.orgId);

    const { link } = await asOrg(grace, () =>
      team.inviteMember(olive, { email: "pat@hope.org", role: "OWNER" }, "http://x"),
    );
    const token = link.split("/").pop()!;
    await expect(
      asOrg(grace, () => team.acceptInvitation({ token, password: "wrong password!!" }, null)),
    ).rejects.toThrow(/isn't the password/);
    await asOrg(grace, () => team.acceptInvitation({ token, password: "owner password!" }, null));

    // Pat can now sign in at both churches with one password.
    await expect(
      asOrg(grace, () => signIn({ email: "pat@hope.org", password: "owner password!" }, null)),
    ).resolves.toBeTruthy();
  });

  it("never lets a church end up without an owner", async () => {
    const grace = await makeOrg("Grace");
    await owner(grace.orgId);
    const { members } = await asOrg(grace, () => team.listTeam());
    await expect(
      asOrg(grace, () => team.changeRole(members[0].membershipId, "EDITOR")),
    ).rejects.toThrow(/at least one owner/);
    await expect(asOrg(grace, () => team.removeMember(members[0].membershipId))).rejects.toThrow(
      /at least one owner/,
    );
  });

  it("keeps invitations to one church", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    const olive = await owner(grace.orgId);
    const { link } = await asOrg(grace, () =>
      team.inviteMember(olive, { email: "pat@x.org", role: "EDITOR" }, "http://x"),
    );
    const token = link.split("/").pop()!;
    expect(await asOrg(hope, () => team.describeInvitation(token))).toBeNull();
    await expect(
      asOrg(hope, () =>
        team.acceptInvitation({ token, name: "Pat", password: "a long password" }, null),
      ),
    ).rejects.toThrow(/expired or was already used/);
    expect((await asOrg(hope, () => team.listTeam())).invitations).toEqual([]);
  });

  it("refuses to invite someone already on the team", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    await expect(
      asOrg(grace, () =>
        team.inviteMember(olive, { email: olive.email, role: "EDITOR" }, "http://x"),
      ),
    ).rejects.toThrow(/already on the team/);
  });
});

describeDb("password reset and verification", () => {
  beforeEach(async () => {
    await resetDatabase();
    sent.length = 0;
    process.env.PUBLIC_URL = "https://display.grace.test";
  });

  it("emails a reset link that works once, then signs the person out everywhere", async () => {
    const grace = await makeOrg("Grace");
    await owner(grace.orgId);
    const before = await asOrg(grace, () =>
      signIn({ email: "owner@grace.org", password: "owner password!" }, null),
    );

    await asOrg(grace, () => recovery.requestPasswordReset({ email: "OWNER@grace.org" }));
    expect(sent).toHaveLength(1);
    expect(linkIn(sent[0].text).startsWith("https://display.grace.test/reset-password/")).toBe(
      true,
    );
    const token = tokenIn(sent[0].text);

    await asOrg(grace, () =>
      recovery.resetPassword({ token, newPassword: "a brand new password" }),
    );
    await expect(
      asOrg(grace, () => recovery.resetPassword({ token, newPassword: "and another one!!" })),
    ).rejects.toThrow(/expired or was already used/);

    expect(await asOrg(grace, () => viewerForToken(before.token))).toBeNull();
    await expect(
      asOrg(grace, () =>
        signIn({ email: "owner@grace.org", password: "a brand new password" }, null),
      ),
    ).resolves.toBeTruthy();
  });

  it("sends nothing for an address that has no account here, and says the same", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await owner(hope.orgId, "pat@hope.org");
    await asOrg(grace, () => recovery.requestPasswordReset({ email: "nobody@x.org" }));
    await asOrg(grace, () => recovery.requestPasswordReset({ email: "pat@hope.org" }));
    expect(sent).toHaveLength(0);
  });

  it("refuses to build links without a trustworthy address", async () => {
    const grace = await makeOrg("Grace");
    await owner(grace.orgId);
    delete process.env.PUBLIC_URL;
    await expect(
      asOrg(grace, () => recovery.requestPasswordReset({ email: "owner@grace.org" })),
    ).rejects.toThrow(/can't send email/);
  });

  it("verifies an address from its link", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    expect(await asOrg(grace, () => recovery.sendVerification(olive.userId))).toBe(true);
    await asOrg(grace, () => recovery.verifyEmail(tokenIn(sent[0].text)));
    const { members } = await asOrg(grace, () => team.listTeam());
    expect(members[0].emailVerified).toBe(true);
    // Already verified: nothing more to send.
    expect(await asOrg(grace, () => recovery.sendVerification(olive.userId))).toBe(false);
  });
});

describeDb("deleting an account", () => {
  beforeEach(resetDatabase);

  it("refuses for the only owner, and works once there is another", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    await expect(
      asOrg(grace, () => recovery.deleteAccount(olive.userId, "owner password!")),
    ).rejects.toThrow(/only owner of Grace/);

    const pat = await owner(grace.orgId, "pat@grace.org");
    await expect(
      asOrg(grace, () => recovery.deleteAccount(olive.userId, "wrong password!")),
    ).rejects.toThrow(/isn't right/);
    await asOrg(grace, () => recovery.deleteAccount(olive.userId, "owner password!"));

    const { members } = await asOrg(grace, () => team.listTeam());
    expect(members.map((m) => m.userId)).toEqual([pat.userId]);
  });
});
