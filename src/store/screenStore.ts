import { create } from "zustand";
import { toast } from "sonner";

import {
  createScreenFn,
  deleteScreenFn,
  importScreensFn,
  listScreensFn,
  saveScreenFn,
  type ScreenInput,
} from "@/lib/api/content.functions";
import { errorMessage } from "@/lib/errors";
import { getWidgetDefinition } from "@/lib/widgetRegistry";
import type { Screen, WidgetInstance, WidgetType } from "@/types";

/**
 * The church's screens, kept on the server.
 *
 * Edits apply to this store at once, so the editor stays instant, and each
 * screen is saved in the background shortly after its last change. A save
 * carries the version it was based on; if somebody else saved in between, the
 * server says so, this store takes their version, and the person is told
 * rather than one of the two edits disappearing.
 */
export type SaveStatus = "saved" | "pending" | "saving" | "error";

interface ScreenState {
  screens: Screen[];
  hydrated: boolean;
  loadError: string | null;
  saveStatus: Record<string, SaveStatus>;
  hydrate: () => Promise<void>;
  createScreen: (input: Partial<Screen> & { name: string }) => Promise<Screen>;
  updateScreen: (id: string, patch: Partial<Screen>) => void;
  deleteScreen: (id: string) => Promise<void>;
  duplicateScreen: (id: string) => Promise<Screen | undefined>;
  importScreens: (screens: Screen[]) => Promise<{ imported: number; failed: number }>;
  addWidget: (
    screenId: string,
    type: WidgetType,
    position?: { x: number; y: number },
  ) => WidgetInstance | undefined;
  updateWidget: (screenId: string, widgetId: string, patch: Partial<WidgetInstance>) => void;
  removeWidget: (screenId: string, widgetId: string) => void;
  duplicateWidget: (screenId: string, widgetId: string) => WidgetInstance | undefined;
  reorderWidget: (
    screenId: string,
    widgetId: string,
    direction: "front" | "back" | "forward" | "backward",
  ) => void;
  setWidgets: (screenId: string, widgets: WidgetInstance[]) => void;
}

/** How long after the last change a screen is saved. */
const SAVE_DELAY_MS = 800;

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** The part of a screen the server stores; ids, timestamps and version are its own. */
export function toInput(screen: Screen): ScreenInput {
  const { id: _id, createdAt: _c, updatedAt: _u, version: _v, ...input } = screen;
  return input;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Bumped on every local change, so a save that returns knows whether it is still current. */
const revisions = new Map<string, number>();

export const useScreenStore = create<ScreenState>((set, get) => {
  const setStatus = (id: string, status: SaveStatus) =>
    set({ saveStatus: { ...get().saveStatus, [id]: status } });

  const replaceScreen = (screen: Screen) =>
    set({ screens: get().screens.map((s) => (s.id === screen.id ? screen : s)) });

  async function save(id: string): Promise<void> {
    const screen = get().screens.find((s) => s.id === id);
    if (!screen) return;
    const revision = revisions.get(id) ?? 0;
    setStatus(id, "saving");
    try {
      const result = await saveScreenFn({
        data: { id, baseVersion: screen.version ?? 1, screen: toInput(screen) },
      });
      if (result.status === "not-found") {
        set({ screens: get().screens.filter((s) => s.id !== id) });
        toast.error(`"${screen.name}" was deleted by someone else.`);
        return;
      }
      if (result.status === "conflict") {
        replaceScreen(result.screen);
        revisions.set(id, revision + 1);
        setStatus(id, "saved");
        toast.warning(
          `Someone else saved "${screen.name}" first. You're now looking at their version.`,
        );
        return;
      }
      const current = get().screens.find((s) => s.id === id);
      if (current)
        replaceScreen({
          ...current,
          version: result.screen.version,
          updatedAt: result.screen.updatedAt,
        });
      // Edited again while this save was in flight: save once more.
      if ((revisions.get(id) ?? 0) !== revision) scheduleSave(id);
      else setStatus(id, "saved");
    } catch (error) {
      setStatus(id, "error");
      toast.error(`Couldn't save "${screen.name}": ${errorMessage(error)}`, {
        action: { label: "Retry", onClick: () => void save(id) },
      });
    }
  }

  function scheduleSave(id: string): void {
    revisions.set(id, (revisions.get(id) ?? 0) + 1);
    setStatus(id, "pending");
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        void save(id);
      }, SAVE_DELAY_MS),
    );
  }

  /** Applies `change` to one screen locally and schedules its save. */
  function edit(id: string, change: (screen: Screen) => Screen): void {
    let found = false;
    const screens = get().screens.map((s) => {
      if (s.id !== id) return s;
      found = true;
      return { ...change(s), updatedAt: new Date().toISOString() };
    });
    if (!found) return;
    set({ screens });
    scheduleSave(id);
  }

  return {
    screens: [],
    hydrated: false,
    loadError: null,
    saveStatus: {},

    hydrate: async () => {
      if (get().hydrated) return;
      try {
        const screens = await listScreensFn();
        set({ screens, hydrated: true, loadError: null });
      } catch (error) {
        set({ hydrated: true, loadError: errorMessage(error) });
      }
    },

    createScreen: async (input) => {
      const created = await createScreenFn({
        data: {
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
          gridSize: input.gridSize,
          snapStep: input.snapStep,
        },
      });
      set({ screens: [created, ...get().screens] });
      return created;
    },

    updateScreen: (id, patch) => edit(id, (s) => ({ ...s, ...patch })),

    deleteScreen: async (id) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
      await deleteScreenFn({ data: { id } });
      set({ screens: get().screens.filter((s) => s.id !== id) });
    },

    duplicateScreen: async (id) => {
      const src = get().screens.find((s) => s.id === id);
      if (!src) return undefined;
      return get().createScreen({
        ...src,
        name: `${src.name} copy`.slice(0, 120),
        widgets: src.widgets.map((w) => ({ ...w, id: uid() })),
      });
    },

    importScreens: async (incoming) => {
      const result = await importScreensFn({ data: { screens: incoming.map(toInput) } });
      const screens = await listScreensFn();
      set({ screens });
      return { imported: result.imported, failed: result.failed.length };
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
      edit(screenId, (s) => ({ ...s, widgets: [...s.widgets, widget] }));
      return widget;
    },

    updateWidget: (screenId, widgetId, patch) =>
      edit(screenId, (s) => ({
        ...s,
        widgets: s.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)),
      })),

    removeWidget: (screenId, widgetId) =>
      edit(screenId, (s) => ({ ...s, widgets: s.widgets.filter((w) => w.id !== widgetId) })),

    duplicateWidget: (screenId, widgetId) => {
      const src = get()
        .screens.find((s) => s.id === screenId)
        ?.widgets.find((w) => w.id === widgetId);
      if (!src) return undefined;
      const copy: WidgetInstance = {
        ...src,
        id: uid(),
        x: Math.min(src.x + 1, 23),
        y: Math.min(src.y + 1, 15),
        config: { ...src.config },
        style: src.style ? { ...src.style } : undefined,
      };
      edit(screenId, (s) => ({ ...s, widgets: [...s.widgets, copy] }));
      return copy;
    },

    reorderWidget: (screenId, widgetId, direction) =>
      edit(screenId, (s) => {
        const idx = s.widgets.findIndex((w) => w.id === widgetId);
        if (idx < 0) return s;
        const widgets = [...s.widgets];
        const [item] = widgets.splice(idx, 1);
        const newIdx =
          direction === "front"
            ? widgets.length
            : direction === "back"
              ? 0
              : direction === "forward"
                ? Math.min(widgets.length, idx + 1)
                : Math.max(0, idx - 1);
        widgets.splice(newIdx, 0, item);
        return { ...s, widgets };
      }),

    setWidgets: (screenId, widgets) => edit(screenId, (s) => ({ ...s, widgets })),
  };
});

/** Whether any screen has changes the server has not confirmed. */
export function hasUnsavedScreens(): boolean {
  return Object.values(useScreenStore.getState().saveStatus).some((s) => s !== "saved");
}
