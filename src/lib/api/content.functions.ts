import { createServerFn } from "@tanstack/react-start";

import { createPreset, deletePreset, listPresets, updatePreset } from "@/server/presets";
import {
  createScreen,
  deleteScreen,
  importScreens,
  listScreens,
  saveScreen,
} from "@/server/screens";
import { getOrgSettingsView, updateOrgSettings, type OrgSettingsView } from "@/server/settings";
import { requireOwner } from "@/server/http";
import type { OrgSettingsData } from "@/server/schemas";
import type { Screen, WidgetStyle } from "@/types";
import { asWire, type WirePreset, type WireScreen } from "@/types/wire";
import { signedIn } from "./middleware";

/** A screen document as the editor holds it, minus what the server owns. */
export type ScreenInput = Omit<Screen, "id" | "createdAt" | "updatedAt" | "version">;

export const listScreensFn = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .handler(async () => asWire<WireScreen[]>(await listScreens()));

export const createScreenFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: ScreenInput) => input)
  .handler(async ({ data }) => asWire<WireScreen>(await createScreen(data)));

export const saveScreenFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { id: string; baseVersion: number; screen: ScreenInput }) => input)
  .handler(async ({ data }) =>
    asWire<{ status: "saved" | "conflict"; screen: WireScreen } | { status: "not-found" }>(
      await saveScreen(String(data.id), data.screen, Number(data.baseVersion)),
    ),
  );

export const deleteScreenFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => ({ deleted: await deleteScreen(String(data.id)) }));

export const importScreensFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { screens: ScreenInput[] }) => input)
  .handler(({ data }) =>
    importScreens(Array.isArray(data.screens) ? data.screens.slice(0, 500) : []),
  );

export const listPresetsFn = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .handler(async () => asWire<WirePreset[]>(await listPresets()));

export interface PresetInputDto {
  widgetType: string;
  label: string;
  description?: string;
  config: Record<string, unknown>;
  style?: WidgetStyle;
}

export const createPresetFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: PresetInputDto) => input)
  .handler(async ({ data }) => asWire<WirePreset>(await createPreset(data)));

export const updatePresetFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { id: string; patch: Partial<PresetInputDto> }) => input)
  .handler(async ({ data }) => asWire<WirePreset>(await updatePreset(String(data.id), data.patch)));

export const deletePresetFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await deletePreset(String(data.id));
    return { ok: true as const };
  });

export const getOrgSettingsFn = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .handler((): Promise<OrgSettingsView> => getOrgSettingsView());

export const updateOrgSettingsFn = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator((input: Partial<OrgSettingsData> & { churchName?: string }) => input)
  .handler(({ data, context }) => {
    if (data.churchName !== undefined) requireOwner(context.viewer);
    return updateOrgSettings(data);
  });
