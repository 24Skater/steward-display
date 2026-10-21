import { createServerFn } from "@tanstack/react-start";

import { listDevices, removeDevice, updateDevice } from "@/server/devices";
import { enforceLimit, limits } from "@/server/http";
import { claimPairing } from "@/server/pairing";
import { signedIn } from "./middleware";

export const listDevicesFn = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .handler(() => listDevices());

export interface ClaimInput {
  code: string;
  name: string;
  screenId: string | null;
}

export const claimPairingFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: ClaimInput) => input)
  .handler(({ data, context }) => {
    enforceLimit(limits.pairClaim, context.viewer.userId);
    return claimPairing({
      code: String(data.code ?? ""),
      name: String(data.name ?? ""),
      screenId: data.screenId ? String(data.screenId) : null,
    });
  });

export const updateDeviceFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { id: string; name?: string; screenId?: string | null }) => input)
  .handler(async ({ data }) => {
    await updateDevice(String(data.id), { name: data.name, screenId: data.screenId });
    return { ok: true as const };
  });

export const removeDeviceFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await removeDevice(String(data.id));
    return { ok: true as const };
  });
