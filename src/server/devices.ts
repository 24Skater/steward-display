import { db } from "./db";
import { UserError } from "./errors";
import { hashSecret } from "./secrets";
import { deviceNameSchema } from "./schemas";
import { getOrgSettings } from "./settings";
import { toRecord, type ScreenRecord } from "./screens";

/** A TV that has not polled for this long is shown as offline. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
/** How often a polling TV's `lastSeenAt` is written. Every poll would be a write per TV per 30s. */
const TOUCH_INTERVAL_MS = 60 * 1000;

export interface DeviceSummary {
  id: string;
  name: string;
  screenId: string | null;
  screenName: string | null;
  lastSeenAt: string | null;
  online: boolean;
  /** Claimed in the admin but the TV has not collected its token yet. */
  awaitingTv: boolean;
}

export async function listDevices(now: Date = new Date()): Promise<DeviceSummary[]> {
  const devices = await db().device.findMany({
    orderBy: { createdAt: "asc" },
    include: { screen: { select: { name: true } } },
  });
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    screenId: device.screenId,
    screenName: device.screen?.name ?? null,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    online: !!device.lastSeenAt && now.getTime() - device.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
    awaitingTv: device.tokenHash === null,
  }));
}

export async function updateDevice(
  id: string,
  patch: { name?: string; screenId?: string | null },
): Promise<void> {
  const data: { name?: string; screenId?: string | null } = {};
  if (patch.name !== undefined) data.name = deviceNameSchema.parse(patch.name);
  if (patch.screenId !== undefined) {
    if (patch.screenId && !(await db().screen.findUnique({ where: { id: patch.screenId } }))) {
      throw new UserError("That screen no longer exists. Pick another.", 400);
    }
    data.screenId = patch.screenId || null;
  }
  const { count } = await db().device.updateMany({ where: { id }, data });
  if (count !== 1) throw new UserError("That TV was removed.", 404);
}

/** Unpairs a TV. Its token stops working on its next poll and it shows a new pairing code. */
export async function removeDevice(id: string): Promise<void> {
  await db().device.deleteMany({ where: { id } });
}

export interface DeviceIdentity {
  id: string;
  name: string;
  screenId: string | null;
}

/** The TV behind a bearer token in the current church, or null. */
export async function deviceForToken(
  token: string | null,
  now: Date = new Date(),
): Promise<DeviceIdentity | null> {
  if (!token) return null;
  const device = await db().device.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { id: true, name: true, screenId: true, lastSeenAt: true },
  });
  if (!device) return null;
  if (!device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db().device.update({ where: { id: device.id }, data: { lastSeenAt: now } });
  }
  return { id: device.id, name: device.name, screenId: device.screenId };
}

/** Everything a TV needs to draw, and the tag it polls with. */
export interface TvPayload {
  deviceName: string;
  timezone: string;
  screen: ScreenRecord | null;
}

export async function payloadForDevice(
  device: DeviceIdentity,
): Promise<{ payload: TvPayload; etag: string }> {
  const [row, settings] = await Promise.all([
    device.screenId ? db().screen.findUnique({ where: { id: device.screenId } }) : null,
    getOrgSettings(),
  ]);
  const payload: TvPayload = {
    deviceName: device.name,
    timezone: settings.timezone,
    screen: row ? toRecord(row) : null,
  };
  // Changes when the screen is edited, swapped, renamed, or the time zone moves.
  const etag = `"${hashSecret(JSON.stringify([device.name, settings.timezone, row?.id ?? null, row?.version ?? 0])).slice(0, 32)}"`;
  return { payload, etag };
}
