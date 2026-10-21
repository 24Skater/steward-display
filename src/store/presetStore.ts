import { create } from "zustand";
import type { WidgetInstance } from "@/types";
import type { WidgetPreset } from "@/lib/widgetPresets";
import { STORAGE_KEYS, readJSON, writeJSON } from "@/lib/storage";

export type CustomPreset = WidgetPreset & {
  widgetType: string;
  custom: true;
  createdAt: string;
};

interface PresetState {
  presets: CustomPreset[];
  hydrated: boolean;
  hydrate: () => void;
  listFor: (widgetType: string) => CustomPreset[];
  create: (
    widgetType: string,
    label: string,
    config: Record<string, unknown>,
    style?: NonNullable<WidgetInstance["style"]>,
    description?: string,
  ) => CustomPreset;
  update: (
    id: string,
    patch: Partial<Omit<CustomPreset, "id" | "custom" | "createdAt" | "widgetType">>,
  ) => void;
  remove: (id: string) => void;
}

function uid() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function persist(presets: CustomPreset[]) {
  writeJSON(STORAGE_KEYS.customPresets, presets);
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ presets: readJSON<CustomPreset[]>(STORAGE_KEYS.customPresets, []), hydrated: true });
  },
  listFor: (widgetType) => get().presets.filter((p) => p.widgetType === widgetType),
  create: (widgetType, label, config, style, description) => {
    const preset: CustomPreset = {
      id: uid(),
      widgetType,
      label,
      description,
      config: { ...config },
      style: style ? { ...style } : undefined,
      custom: true,
      createdAt: new Date().toISOString(),
    };
    const next = [...get().presets, preset];
    set({ presets: next });
    persist(next);
    return preset;
  },
  update: (id, patch) => {
    const next = get().presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    set({ presets: next });
    persist(next);
  },
  remove: (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    set({ presets: next });
    persist(next);
  },
}));
