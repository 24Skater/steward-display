import { create } from "zustand";
import type { Settings } from "@/types";
import { STORAGE_KEYS, readJSON, writeJSON } from "@/lib/storage";

const DEFAULT_SETTINGS: Settings = {
  orgName: "Your Organization",
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  theme: "light",
  defaultOrientation: "landscape",
  defaultBackground: "#0B1220",
  defaultGridSize: 1,
  defaultSnapStep: 4,
};

interface SettingsState extends Settings {
  hydrated: boolean;
  hydrate: () => void;
  update: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const loaded = readJSON<Partial<Settings>>(STORAGE_KEYS.settings, {});
    set({ ...DEFAULT_SETTINGS, ...loaded, hydrated: true });
  },
  update: (patch) => {
    set(patch);
    const { hydrated: _h, hydrate: _hy, update: _u, ...rest } = get();
    writeJSON(STORAGE_KEYS.settings, rest);
  },
}));