import { beforeEach, expect, it, vi } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";

// Capture outgoing mail instead of sending it; `mailWorks` simulates a server without email.
const sent: { to: string; subject: string; text: string }[] = [];
let mailWorks = true;
vi.mock("./mailer", () => ({
  isEmailConfigured: () => mailWorks,
  sendEmail: async (email: { to: string; subject: string; text: string }) => {
    if (!mailWorks) return { sent: false, reason: "not-configured" };
    sent.push(email);
    return { sent: true };
  },
}));

const { bypass, db } = await import("./db");
const { hashPassword } = await import("./password");
const { changePassword, signIn } = await import("./accounts");
const { viewerForToken } = await import("./sessions");
const { personNameSchema } = await import("./schemas");
const team = await import("./team");
const recovery = await import("./account-recovery");

async function owner(orgId: string, email = "owner@grace.org", role: "OWNER" | "EDITOR" = "OWNER") {
  const user = await db().user.create(
    bypass({ data: { email, name: "Olive", passwordHash: await hashPassword("owner password!") } }),
  );
  await db().membership.create(bypass({ data: { orgId, userId: user.id, role } }));
  return { userId: user.id, sessionId: "s", name: "Olive", email, role, emailVerified: false };
}

const linkIn = (text: string) => text.match(/https?:\/\/\S+/)?.[0] ?? "";
const tokenIn = (text: string) => linkIn(text).split("/").pop() ?? "";
const lastTokenTo = (to: string) => tokenIn([...sent].reverse().find((m) => m.to === to)!.text);

beforeEach(() => {
  sent.length = 0;
  mailWorks = true;
  process.env.PUBLIC_URL = "https://display.grace.test";
});

describeDb("team invitations", () => {
  beforeEach(resetDatabase);

  it("emails the link (and only emails it), and the new person joins with the role", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);

    const result = await asOrg(grace, () =>
      team.inviteMember(olive, { email: "Pat@Grace.org", role: "EDITOR" }, "http://ignored"),
    );
    // The owner never sees a link that was emailed: they cannot use it as Pat.
    expect(result).toEqual({ link: null, emailed: true });
    expect(linkIn(sent[0].text).startsWith("https://display.grace.test/invite/")).toBe(true);
    const token = lastTokenTo("pat@grace.org");

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
    await expect(
      asOrg(grace, () =>
        team.acceptInvitation({ token, name: "Eve", password: "another password" }, null),
      ),
    ).rejects.toThrow(/expired or was already used/);
  });

  it("hands the owner the link when the server cannot email it", async () => {
    mailWorks = false;
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    const result = await asOrg(grace, () =>
      team.inviteMember(olive, { email: "pat@grace.org", role: "EDITOR" }, "http://ignored"),
    );
    expect(result.emailed).toBe(false);
    expect(result.link?.startsWith("https://display.grace.test/invite/sdi_")).toBe(true);
  });

  it("lets someone from another church join with the password they already have", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await owner(hope.orgId, "pat@hope.org");
    const olive = await owner(grace.orgId);

    await asOrg(grace, () =>
      team.inviteMember(olive, { email: "pat@hope.org", role: "OWNER" }, "http://x"),
    );
    const token = lastTokenTo("pat@hope.org");
    await expect(
      asOrg(grace, () => team.acceptInvitation({ token, password: "wrong password!!" }, null)),
    ).rejects.toThrow(/isn't the password/);
    await asOrg(grace, () => team.acceptInvitation({ token, password: "owner password!" }, null));
    await expect(
      asOrg(grace, () => signIn({ email: "pat@hope.org", password: "owner password!" }, null)),
    ).resolves.toBeTruthy();
  });

  it("refuses an expired invitation", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    const longAgo = new Date(Date.now() - team.INVITATION_TTL_MS - 60_000);
    await asOrg(grace, () =>
      team.inviteMember(olive, { email: "pat@x.org", role: "EDITOR" }, "http://x", longAgo),
    );
    const token = lastTokenTo("pat@x.org");
    expect(await asOrg(grace, () => team.describeInvitation(token))).toBeNull();
    await expect(
      asOrg(grace, () =>
        team.acceptInvitation({ token, name: "Pat", password: "a long password" }, null),
      ),
    ).rejects.toThrow(/expired/);
  });

  it("keeps invitations to one church", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    const olive = await owner(grace.orgId);
    await asOrg(grace, () =>
      team.inviteMember(olive, { email: "pat@x.org", role: "EDITOR" }, "http://x"),
    );
    const token = lastTokenTo("pat@x.org");
    const [invitation] = (await asOrg(grace, () => team.listTeam())).invitations;
    expect(await asOrg(hope, () => team.describeInvitation(token))).toBeNull();
    await expect(
      asOrg(hope, () =>
        team.acceptInvitation({ token, name: "Pat", password: "a long password" }, null),
      ),
    ).rejects.toThrow(/expired or was already used/);
    // Nor can another church cancel it.
    expect(await asOrg(hope, () => team.revokeInvitation(invitation.id))).toBe(false);
    expect((await asOrg(grace, () => team.listTeam())).invitations).toHaveLength(1);
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

  it("refuses names that are really web addresses", () => {
    expect(personNameSchema.safeParse("Security alert: visit evil.example.com").success).toBe(
      false,
    );
    expect(personNameSchema.safeParse("see https://x").success).toBe(false);
    expect(personNameSchema.safeParse("Mary-Kate O'Brien").success).toBe(true);
    expect(personNameSchema.safeParse("St. John's Youth Team").success).toBe(true);
  });
});

describeDb("roles and removal", () => {
  beforeEach(resetDatabase);

  it("changes a role, and removing someone signs them out here but not elsewhere", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await owner(grace.orgId);
    const pat = await owner(grace.orgId, "pat@x.org", "EDITOR");
    await db().membership.create(bypass({ data: { orgId: hope.orgId, userId: pat.userId } }));
    const creds = { email: "pat@x.org", password: "owner password!" };
    const atGrace = await asOrg(grace, () => signIn(creds, null));
    const atHope = await asOrg(hope, () => signIn(creds, null));

    const patRow = (await asOrg(grace, () => team.listTeam())).members.find(
      (m) => m.userId === pat.userId,
    )!;
    await asOrg(grace, () => team.changeRole(patRow.membershipId, "OWNER"));
    expect((await asOrg(grace, () => viewerForToken(atGrace.token)))?.role).toBe("OWNER");

    await asOrg(grace, () => team.removeMember(patRow.membershipId));
    expect(await asOrg(grace, () => viewerForToken(atGrace.token))).toBeNull();
    expect(await asOrg(hope, () => viewerForToken(atHope.token))).not.toBeNull();
  });

  it("never lets a church end up without an owner, even when two owners act at once", async () => {
    const grace = await makeOrg("Grace");
    await owner(grace.orgId, "a@x.org");
    await owner(grace.orgId, "b@x.org");
    const { members } = await asOrg(grace, () => team.listTeam());

    const results = await Promise.allSettled([
      asOrg(grace, () => team.changeRole(members[0].membershipId, "EDITOR")),
      asOrg(grace, () => team.changeRole(members[1].membershipId, "EDITOR")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const owners = (await asOrg(grace, () => team.listTeam())).members.filter(
      (m) => m.role === "OWNER",
    );
    expect(owners).toHaveLength(1);

    await expect(asOrg(grace, () => team.removeMember(owners[0].membershipId))).rejects.toThrow(
      /at least one owner/,
    );
  });

  it("cancels the invitations of an owner who is removed, so they cannot walk back in", async () => {
    const grace = await makeOrg("Grace");
    await owner(grace.orgId, "a@x.org");
    const rogue = await owner(grace.orgId, "rogue@x.org");
    await asOrg(grace, () =>
      team.inviteMember(rogue, { email: "alt@attacker.test", role: "OWNER" }, "http://x"),
    );
    const token = lastTokenTo("alt@attacker.test");
    const rogueRow = (await asOrg(grace, () => team.listTeam())).members.find(
      (m) => m.userId === rogue.userId,
    )!;

    await asOrg(grace, () => team.removeMember(rogueRow.membershipId));
    expect((await asOrg(grace, () => team.listTeam())).invitations).toEqual([]);
    await expect(
      asOrg(grace, () =>
        team.acceptInvitation({ token, name: "Alt", password: "a long password" }, null),
      ),
    ).rejects.toThrow(/expired or was already used/);
  });
});

describeDb("password reset and verification", () => {
  beforeEach(resetDatabase);

  const reset = async (org: Awaited<ReturnType<typeof makeOrg>>, email: string) =>
    (await asOrg(org, () => recovery.requestPasswordReset({ email }))).settled;

  it("emails a reset link that works once, then signs the person out everywhere", async () => {
    const grace = await makeOrg("Grace");
    await owner(grace.orgId);
    const before = await asOrg(grace, () =>
      signIn({ email: "owner@grace.org", password: "owner password!" }, null),
    );

    await reset(grace, "OWNER@grace.org");
    expect(sent).toHaveLength(1);
    expect(linkIn(sent[0].text).startsWith("https://display.grace.test/reset-password/")).toBe(
      true,
    );
    const token = tokenIn(sent[0].text);
    expect(await recovery.isResetLinkValid(token)).toBe(true);

    await asOrg(grace, () =>
      recovery.resetPassword({ token, newPassword: "a brand new password" }),
    );
    expect(await recovery.isResetLinkValid(token)).toBe(false);
    await expect(
      asOrg(grace, () => recovery.resetPassword({ token, newPassword: "and another one!!" })),
    ).rejects.toThrow(/expired or was already used/);

    expect(await asOrg(grace, () => viewerForToken(before.token))).toBeNull();
    const after = await asOrg(grace, () =>
      signIn({ email: "owner@grace.org", password: "a brand new password" }, null),
    );
    // The link proved the inbox, so the address is now confirmed.
    expect((await asOrg(grace, () => viewerForToken(after.token)))?.emailVerified).toBe(true);
  });

  it("retires an earlier link when a newer one is sent, or the password is changed", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    await reset(grace, "owner@grace.org");
    const first = tokenIn(sent[0].text);
    await reset(grace, "owner@grace.org");
    expect(await recovery.isResetLinkValid(first)).toBe(false);
    const second = tokenIn(sent[1].text);

    await asOrg(grace, () =>
      changePassword(olive.userId, "keep", {
        currentPassword: "owner password!",
        newPassword: "changed it myself",
      }),
    );
    expect(await recovery.isResetLinkValid(second)).toBe(false);
  });

  it("sends nothing for an address with no account here, and says the same", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    await owner(hope.orgId, "pat@hope.org");
    await reset(grace, "nobody@x.org");
    await reset(grace, "pat@hope.org");
    expect(sent).toHaveLength(0);
  });

  it("lets the real owner of an address take back an account someone else set up with it", async () => {
    // An owner who could see an invitation link (no email on their server)
    // opens it themselves and creates Pat's account with a password they chose.
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    const mallory = await owner(grace.orgId, "mallory@x.org");
    mailWorks = false;
    const { link } = await asOrg(grace, () =>
      team.inviteMember(mallory, { email: "pat@hope.org", role: "EDITOR" }, "http://x"),
    );
    await asOrg(grace, () =>
      team.acceptInvitation(
        { token: link!.split("/").pop()!, name: "Pat", password: "mallory chose it" },
        null,
      ),
    );

    // Later Hope invites the real Pat, by email. Pat resets by email and is in.
    mailWorks = true;
    const hopeOwner = await owner(hope.orgId, "owner@hope.org");
    await asOrg(hope, () =>
      team.inviteMember(hopeOwner, { email: "pat@hope.org", role: "EDITOR" }, "http://x"),
    );
    const invite = lastTokenTo("pat@hope.org");
    await reset(hope, "pat@hope.org");
    const resetToken = lastTokenTo("pat@hope.org");
    await asOrg(hope, () =>
      recovery.resetPassword({ token: resetToken, newPassword: "the real pat's password" }),
    );
    await asOrg(hope, () =>
      team.acceptInvitation({ token: invite, password: "the real pat's password" }, null),
    );
    // And the password Mallory chose no longer works anywhere.
    await expect(
      asOrg(grace, () => signIn({ email: "pat@hope.org", password: "mallory chose it" }, null)),
    ).rejects.toThrow(/don't match/);
  });

  it("refuses to build links without a trustworthy address", async () => {
    const grace = await makeOrg("Grace");
    await owner(grace.orgId);
    delete process.env.PUBLIC_URL;
    await expect(
      asOrg(grace, () => recovery.requestPasswordReset({ email: "owner@grace.org" })),
    ).rejects.toThrow(/can't send email/);
  });

  it("verifies an address, and a link a mail scanner already opened still says yes", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    expect(await asOrg(grace, () => recovery.sendVerification(olive.userId))).toBe(true);
    const token = tokenIn(sent[0].text);
    await asOrg(grace, () => recovery.verifyEmail(token));
    await expect(asOrg(grace, () => recovery.verifyEmail(token))).resolves.toBeUndefined();
    const { members } = await asOrg(grace, () => team.listTeam());
    expect(members[0].emailVerified).toBe(true);
    expect(await asOrg(grace, () => recovery.sendVerification(olive.userId))).toBe(false);
  });
});

describeDb("deleting an account", () => {
  beforeEach(resetDatabase);

  it("refuses for the only owner, and works once there is another, taking their invitations", async () => {
    const grace = await makeOrg("Grace");
    const olive = await owner(grace.orgId);
    await expect(
      asOrg(grace, () => recovery.deleteAccount(olive.userId, "owner password!")),
    ).rejects.toThrow(/only owner of Grace/);

    const pat = await owner(grace.orgId, "pat@grace.org");
    await asOrg(grace, () =>
      team.inviteMember(olive, { email: "new@x.org", role: "OWNER" }, "http://x"),
    );
    await expect(
      asOrg(grace, () => recovery.deleteAccount(olive.userId, "wrong password!")),
    ).rejects.toThrow(/isn't right/);
    await asOrg(grace, () => recovery.deleteAccount(olive.userId, "owner password!"));

    const after = await asOrg(grace, () => team.listTeam());
    expect(after.members.map((m) => m.userId)).toEqual([pat.userId]);
    expect(after.invitations).toEqual([]);
  });

  it("lets only one of two owners delete themselves at the same moment", async () => {
    const grace = await makeOrg("Grace");
    const a = await owner(grace.orgId, "a@x.org");
    const b = await owner(grace.orgId, "b@x.org");
    const results = await Promise.allSettled([
      asOrg(grace, () => recovery.deleteAccount(a.userId, "owner password!")),
      asOrg(grace, () => recovery.deleteAccount(b.userId, "owner password!")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const owners = (await asOrg(grace, () => team.listTeam())).members;
    expect(owners).toHaveLength(1);
  });
});
