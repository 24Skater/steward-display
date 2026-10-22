import type { UserTokenPurpose } from "@/generated/prisma/enums";
import { db } from "./db";
import { hashSecret, newSecret } from "./secrets";

/**
 * Single-use links for one person: reset a password, verify an address.
 *
 * Issuing a new link retires any earlier unused one for the same purpose, so
 * only the most recent email works. Consuming is one conditional update, so a
 * link clicked twice at once still works exactly once.
 */
export const TOKEN_TTL_MS: Record<UserTokenPurpose, number> = {
  RESET_PASSWORD: 60 * 60 * 1000,
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
};

export async function issueUserToken(
  userId: string,
  purpose: UserTokenPurpose,
  now: Date = new Date(),
): Promise<string> {
  await db().userToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: now },
  });
  const token = newSecret(purpose === "RESET_PASSWORD" ? "sdr" : "sdv");
  await db().userToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashSecret(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
    },
  });
  return token;
}

/** The user a still-valid link belongs to, marking it used; null if it is unknown, used or expired. */
export async function consumeUserToken(
  token: string,
  purpose: UserTokenPurpose,
  now: Date = new Date(),
): Promise<string | null> {
  const [used] = await db().userToken.updateManyAndReturn({
    where: { tokenHash: hashSecret(token), purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
    select: { userId: true },
  });
  return used?.userId ?? null;
}

/** Whether a link is still good, without using it up: for showing the right page. */
export async function isUserTokenValid(
  token: string,
  purpose: UserTokenPurpose,
  now: Date = new Date(),
): Promise<boolean> {
  const row = await db().userToken.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { purpose: true, usedAt: true, expiresAt: true },
  });
  return !!row && row.purpose === purpose && !row.usedAt && row.expiresAt > now;
}
