import { create } from "zustand";
import { toast } from "sonner";

import {
  createPresetFn,
  deletePresetFn,
  listPresetsFn,
  updatePresetFn,
} from "@/lib/api/content.functions";
import { errorMessage } from "@/lib/errors";
import type { WidgetPreset } from "@/lib/widgetPresets";
import type { WidgetInstance } from "@/types";

export type CustomPreset = WidgetPreset & {
  widgetType: string;
  custom: true;
  createdAt: string;
};

interface PresetState {
  presets: CustomPreset[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  listFor: (widgetType: string) => CustomPreset[];
  create: (
    widgetType: string,
    label: string,
    config: Record<string, unknown>,
    style?: NonNullable<WidgetInstance["style"]>,
    description?: string,
  ) => Promise<void>;
  update: (
    id: string,
    patch: Partial<Omit<CustomPreset, "id" | "custom" | "createdAt" | "widgetType">>,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function fromWire(p: {
  id: string;
  widgetType: string;
  label: string;
  description?: string;
  config: Record<string, unknown>;
  style?: WidgetInstance["style"];
  createdAt: string;
}): CustomPreset {
  return { ...p, custom: true };
}

/**
 * A church's saved widget presets, kept on the server. Changes show at once and
 * roll back, with a message, if the server refuses them.
 */
export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      set({ presets: (await listPresetsFn()).map(fromWire), hydrated: true });
    } catch (error) {
      set({ hydrated: true });
      toast.error(`Couldn't load presets: ${errorMessage(error)}`);
    }
  },

  listFor: (widgetType) => get().presets.filter((p) => p.widgetType === widgetType),

  create: async (widgetType, label, config, style, description) => {
    try {
      const created = await createPresetFn({
        data: { widgetType, label, description, config, style },
      });
      set({ presets: [...get().presets, fromWire(created)] });
      toast.success(`Saved preset "${label}"`);
    } catch (error) {
      toast.error(`Couldn't save the preset: ${errorMessage(error)}`);
    }
  },

  update: async (id, patch) => {
    const before = get().presets;
    set({ presets: before.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    try {
      const { label, description, config, style } = patch;
      await updatePresetFn({ data: { id, patch: { label, description, config, style } } });
    } catch (error) {
      set({ presets: before });
      toast.error(`Couldn't update the preset: ${errorMessage(error)}`);
    }
  },

  remove: async (id) => {
    const before = get().presets;
    set({ presets: before.filter((p) => p.id !== id) });
    try {
      await deletePresetFn({ data: { id } });
    } catch (error) {
      set({ presets: before });
      toast.error(`Couldn't delete the preset: ${errorMessage(error)}`);
    }
  },
}));
