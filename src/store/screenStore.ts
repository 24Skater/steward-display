import { create } from "zustand";
import type { Screen, WidgetInstance, WidgetType } from "@/types";
import { STORAGE_KEYS, readJSON, writeJSON } from "@/lib/storage";
import { getWidgetDefinition } from "@/lib/widgetRegistry";

interface ScreenState {
  screens: Screen[];
  hydrated: boolean;
  hydrate: () => void;
  createScreen: (input: Partial<Screen> & { name: string }) => Screen;
  updateScreen: (id: string, patch: Partial<Screen>) => void;
  deleteScreen: (id: string) => void;
  duplicateScreen: (id: string) => Screen | undefined;
  importScreens: (screens: Screen[]) => void;
  // widget ops
  addWidget: (screenId: string, type: WidgetType, position?: { x: number; y: number }) => WidgetInstance | undefined;
  updateWidget: (screenId: string, widgetId: string, patch: Partial<WidgetInstance>) => void;
  removeWidget: (screenId: string, widgetId: string) => void;
  duplicateWidget: (screenId: string, widgetId: string) => WidgetInstance | undefined;
  reorderWidget: (screenId: string, widgetId: string, direction: "front" | "back" | "forward" | "backward") => void;
  setWidgets: (screenId: string, widgets: WidgetInstance[]) => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function persist(screens: Screen[]) {
  writeJSON(STORAGE_KEYS.screens, screens);
}

export const useScreenStore = create<ScreenState>((set, get) => ({
  screens: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const loaded = readJSON<Screen[]>(STORAGE_KEYS.screens, []);
    set({ screens: loaded, hydrated: true });
  },
  createScreen: (input) => {
    const now = new Date().toISOString();
    const screen: Screen = {
      id: uid(),
      name: input.name,
      description: input.description,
      orientation: input.orientation ?? "landscape",
      resolution: input.resolution ?? "1920x1080",
      customWidth: input.customWidth,
      customHeight: input.customHeight,
      backgroundColor: input.backgroundColor ?? "#0B1220",
      backgroundImage: input.backgroundImage,
      showWatermark: input.showWatermark ?? false,
      widgets: input.widgets ?? [],
      schedule: input.schedule,
      createdAt: now,
      updatedAt: now,
    };
    const screens = [screen, ...get().screens];
    set({ screens });
    persist(screens);
    return screen;
  },
  updateScreen: (id, patch) => {
    const screens = get().screens.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
    );
    set({ screens });
    persist(screens);
  },
  deleteScreen: (id) => {
    const screens = get().screens.filter((s) => s.id !== id);
    set({ screens });
    persist(screens);
  },
  duplicateScreen: (id) => {
    const src = get().screens.find((s) => s.id === id);
    if (!src) return undefined;
    const now = new Date().toISOString();
    const copy: Screen = {
      ...src,
      id: uid(),
      name: `${src.name} copy`,
      widgets: src.widgets.map((w) => ({ ...w, id: uid() })),
      createdAt: now,
      updatedAt: now,
    };
    const screens = [copy, ...get().screens];
    set({ screens });
    persist(screens);
    return copy;
  },
  importScreens: (incoming) => {
    const screens = [...incoming, ...get().screens.filter((s) => !incoming.find((i) => i.id === s.id))];
    set({ screens });
    persist(screens);
  },
  addWidget: (screenId, type, position) => {
    const def = getWidgetDefinition(type);
    if (!def) return undefined;
    const widget: WidgetInstance = {
      id: uid(),
      widgetType: type,
      x: position?.x ?? 6,
      y: position?.y ?? 4,
      w: def.defaultSize.w,
      h: def.defaultSize.h,
      config: { ...def.defaultConfig },
    };
    const screens = get().screens.map((s) =>
      s.id === screenId ? { ...s, widgets: [...s.widgets, widget], updatedAt: new Date().toISOString() } : s,
    );
    set({ screens });
    persist(screens);
    return widget;
  },
  updateWidget: (screenId, widgetId, patch) => {
    const screens = get().screens.map((s) =>
      s.id === screenId
        ? {
            ...s,
            widgets: s.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)),
            updatedAt: new Date().toISOString(),
          }
        : s,
    );
    set({ screens });
    persist(screens);
  },
  removeWidget: (screenId, widgetId) => {
    const screens = get().screens.map((s) =>
      s.id === screenId
        ? { ...s, widgets: s.widgets.filter((w) => w.id !== widgetId), updatedAt: new Date().toISOString() }
        : s,
    );
    set({ screens });
    persist(screens);
  },
  duplicateWidget: (screenId, widgetId) => {
    const screen = get().screens.find((s) => s.id === screenId);
    const src = screen?.widgets.find((w) => w.id === widgetId);
    if (!screen || !src) return undefined;
    const copy: WidgetInstance = {
      ...src,
      id: uid(),
      x: Math.min(src.x + 1, 23),
      y: Math.min(src.y + 1, 15),
      config: { ...src.config },
      style: src.style ? { ...src.style } : undefined,
    };
    const screens = get().screens.map((s) =>
      s.id === screenId
        ? { ...s, widgets: [...s.widgets, copy], updatedAt: new Date().toISOString() }
        : s,
    );
    set({ screens });
    persist(screens);
    return copy;
  },
  reorderWidget: (screenId, widgetId, direction) => {
    const screen = get().screens.find((s) => s.id === screenId);
    if (!screen) return;
    const idx = screen.widgets.findIndex((w) => w.id === widgetId);
    if (idx < 0) return;
    const widgets = [...screen.widgets];
    const [item] = widgets.splice(idx, 1);
    let newIdx = idx;
    if (direction === "front") newIdx = widgets.length;
    else if (direction === "back") newIdx = 0;
    else if (direction === "forward") newIdx = Math.min(widgets.length, idx + 1);
    else if (direction === "backward") newIdx = Math.max(0, idx - 1);
    widgets.splice(newIdx, 0, item);
    const screens = get().screens.map((s) =>
      s.id === screenId ? { ...s, widgets, updatedAt: new Date().toISOString() } : s,
    );
    set({ screens });
    persist(screens);
  },
  setWidgets: (screenId, widgets) => {
    const screens = get().screens.map((s) =>
      s.id === screenId ? { ...s, widgets, updatedAt: new Date().toISOString() } : s,
    );
    set({ screens });
    persist(screens);
  },
}));