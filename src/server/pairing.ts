import { db } from "./db";
import { UserError } from "./errors";
import { inOrg } from "./org-context";
import { hashSecret, newPairingCode, newSecret, normalizePairingCode } from "./secrets";
import { deviceNameSchema } from "./schemas";

/**
 * Pairing a TV with a church, without typing a password on a TV remote.
 *
 *  1. The TV asks for a code (`startPairing`) and shows it, keeping a poll
 *     secret only it knows.
 *  2. Someone signed in types the code into the admin (`claimPairing`), names
 *     the TV and picks its screen. That creates the device.
 *  3. The TV, polling with its secret (`collectPairing`), is handed its device
 *     token, once. Only the token's hash is stored.
 *
 * The code alone is worth nothing: it can only attach a TV to the church of
 * whoever typed it, and only the TV holding the poll secret receives the token.
 */
export const PAIRING_TTL_MS = 10 * 60 * 1000;
/** How long after claiming a TV may still collect its token. */
const COLLECT_WINDOW_MS = 60 * 60 * 1000;

export interface StartedPairing {
  code: string;
  pollSecret: string;
  expiresAt: string;
}

export type CollectResult =
  | { status: "pending"; code: string; expiresAt: string }
  | { status: "expired" }
  | { status: "paired"; deviceToken: string; deviceName: string };

export async function startPairing(now: Date = new Date()): Promise<StartedPairing> {
  // Housekeeping on the way in: codes nobody claimed and pairings long collected.
  await db().pairing.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - COLLECT_WINDOW_MS) } },
  });

  const pollSecret = newSecret("sdp");
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairingCode();
    const clash = await db().pairing.findFirst({
      where: { code, expiresAt: { gt: now }, deviceId: null },
      select: { id: true },
    });
    if (clash) continue;
    await db().pairing.create({
      data: inOrg({ code, pollSecretHash: hashSecret(pollSecret), expiresAt }),
    });
    return { code, pollSecret, expiresAt: expiresAt.toISOString() };
  }
  throw new UserError("Couldn't make a pairing code. Reload the page to try again.", 503);
}

export async function claimPairing(
  input: { code: string; name: string; screenId: string | null },
  now: Date = new Date(),
): Promise<{ deviceId: string }> {
  const code = normalizePairingCode(input.code);
  const name = deviceNameSchema.parse(input.name);
  const screenId = input.screenId || null;

  if (
    screenId &&
    !(await db().screen.findUnique({ where: { id: screenId }, select: { id: true } }))
  ) {
    throw new UserError("That screen no longer exists. Pick another.", 400);
  }

  const pairing = await db().pairing.findFirst({
    where: { code, expiresAt: { gt: now }, deviceId: null },
    select: { id: true },
  });
  if (!pairing) {
    throw new UserError(
      "That code isn't waiting to be paired. Check the TV: codes last ten minutes.",
      404,
    );
  }

  return db().$transaction(async (tx) => {
    const device = await tx.device.create({ data: inOrg({ name, screenId }) });
    // Two people typing the same code at once: exactly one of them wins.
    const { count } = await tx.pairing.updateMany({
      where: { id: pairing.id, deviceId: null },
      data: { deviceId: device.id },
    });
    if (count !== 1) throw new UserError("That code was just used. Ask the TV for a new one.", 409);
    return { deviceId: device.id };
  });
}

export async function collectPairing(
  pollSecret: string,
  now: Date = new Date(),
): Promise<CollectResult> {
  const pairing = await db().pairing.findUnique({
    where: { pollSecretHash: hashSecret(pollSecret) },
    include: { device: { select: { id: true, name: true } } },
  });
  if (!pairing) return { status: "expired" };

  if (!pairing.device) {
    return pairing.expiresAt > now
      ? { status: "pending", code: pairing.code, expiresAt: pairing.expiresAt.toISOString() }
      : { status: "expired" };
  }

  const tooLate = now.getTime() - pairing.createdAt.getTime() > COLLECT_WINDOW_MS;
  if (pairing.deliveredAt || tooLate) return { status: "expired" };

  const deviceToken = newSecret("sdt");
  return db().$transaction(async (tx) => {
    // A pairing pays out once, even to two polls in flight.
    const { count } = await tx.pairing.updateMany({
      where: { id: pairing.id, deliveredAt: null },
      data: { deliveredAt: now },
    });
    if (count !== 1) return { status: "expired" as const };
    await tx.device.update({
      where: { id: pairing.device!.id },
      data: { tokenHash: hashSecret(deviceToken), lastSeenAt: now },
    });
    return { status: "paired" as const, deviceToken, deviceName: pairing.device!.name };
  });
}
