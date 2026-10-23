import { bypass, db } from "./db";

/**
 * Someone has just proven they own an account's email address: the console
 * vouched for it at provisioning, or Steward ID signed them in with it
 * verified. Hand them the account clean.
 *
 * An account nobody has proven an address for may have been made by anyone.
 * Accepting an invitation creates one with a password for whoever holds the
 * link, so a stranger can invite `victim@church.org` to a church of their own,
 * accept it themselves, and wait. Without this, the real owner signing up
 * later would inherit an account the stranger can still sign in to.
 *
 * So when the address is proven on an account that was never proven (no
 * verified email, no Steward ID bound), its password and every session it
 * holds, in every church, are dropped. The owner signs in with Steward ID, or
 * sets a password through "forgot password", which mails the proven address.
 * An account already proven is left alone.
 */
export async function claimUnprovenAccount(userId: string, now: Date = new Date()): Promise<void> {
  // Sessions are per church; this is about the person, across all of them.
  const { count } = await db().user.updateMany(
    bypass({
      where: { id: userId, emailVerifiedAt: null, ssoSubject: null },
      data: { passwordHash: null, emailVerifiedAt: now },
    }),
  );
  if (count === 1) await db().session.deleteMany(bypass({ where: { userId } }));
}
