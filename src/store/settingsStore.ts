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
  maxGridHistorySize: 10,
  gridImportIncludeDefaults: true,
  gridImportIncludeHistory: true,
  lastGridImport: undefined,
};

interface SettingsState extends Settings {
  hydrated: boolean;
  hydrate: () => void;
  update: (patch: Partial<Settings>) => void;
  resetGridDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const stored = readJSON<Partial<Settings> & { weatherApiKey?: unknown }>(
      STORAGE_KEYS.settings,
      {},
    );
    // Older builds kept a third-party API key here. Drop it so it is never stored or exported.
    const { weatherApiKey, ...loaded } = stored;
    set({ ...DEFAULT_SETTINGS, ...loaded, hydrated: true });
    if (weatherApiKey !== undefined) writeJSON(STORAGE_KEYS.settings, loaded);
  },
  update: (patch) => {
    set(patch);
    const { hydrated: _h, hydrate: _hy, update: _u, resetGridDefaults: _r, ...rest } = get();
    writeJSON(STORAGE_KEYS.settings, rest);
  },
  resetGridDefaults: () => {
    const patch = {
      defaultGridSize: DEFAULT_SETTINGS.defaultGridSize,
      defaultSnapStep: DEFAULT_SETTINGS.defaultSnapStep,
    };
    set(patch);
    const { hydrated: _h, hydrate: _hy, update: _u, resetGridDefaults: _r, ...rest } = get();
    writeJSON(STORAGE_KEYS.settings, rest);
  },
}));
