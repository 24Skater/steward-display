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
  /** Names of the screens that could not be imported are in `failed`. */
  importScreens: (screens: Screen[]) => Promise<{ imported: number; failed: string[] }>;
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

const MEDIA_URL = /^https?:\/\//i;
const URL_KEYS = new Set(["src", "url", "href", "image", "imageUrl", "poster"]);

/** An address the server will accept: empty, or http(s). Same rule as src/server/schemas.ts. */
function isAcceptableUrl(value: unknown): boolean {
  return typeof value !== "string" || value === "" || MEDIA_URL.test(value);
}

/**
 * The part of a screen the server stores; ids, timestamps and version are its
 * own. A half-typed address ("www.church.org/x.jpg", or "htt" mid-word) is sent
 * as empty rather than sinking the whole save: it stays in the editor, and the
 * widget shows its setup hint until it is a real address.
 */
export function toInput(screen: Screen): ScreenInput {
  const { id: _id, createdAt: _c, updatedAt: _u, version: _v, ...input } = screen;
  return {
    ...input,
    backgroundImage: isAcceptableUrl(input.backgroundImage) ? input.backgroundImage : undefined,
    widgets: input.widgets.map((w) => ({
      ...w,
      config: Object.fromEntries(
        Object.entries(w.config).map(([key, value]) =>
          URL_KEYS.has(key) && !isAcceptableUrl(value) ? [key, ""] : [key, value],
        ),
      ),
    })),
  };
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Bumped on every local change, so a save that returns knows whether it is still current. */
const revisions = new Map<string, number>();
/** One save per screen at a time: a second would carry the same base version and conflict with the first. */
const inFlight = new Set<string>();
/** Screens this browser is deleting, so their own vanishing is not reported as someone else's doing. */
const deleting = new Set<string>();

export const useScreenStore = create<ScreenState>((set, get) => {
  const setStatus = (id: string, status: SaveStatus) =>
    set({ saveStatus: { ...get().saveStatus, [id]: status } });

  const forget = (id: string) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    revisions.delete(id);
    const { [id]: _gone, ...saveStatus } = get().saveStatus;
    set({ screens: get().screens.filter((s) => s.id !== id), saveStatus });
  };

  const replaceScreen = (screen: Screen) =>
    set({ screens: get().screens.map((s) => (s.id === screen.id ? screen : s)) });

  async function save(id: string): Promise<void> {
    const screen = get().screens.find((s) => s.id === id);
    if (!screen || deleting.has(id)) return;
    // Already saving: when that save returns it sees the newer revision and goes again.
    if (inFlight.has(id)) return;
    inFlight.add(id);
    const revision = revisions.get(id) ?? 0;
    setStatus(id, "saving");
    try {
      const result = await saveScreenFn({
        data: { id, baseVersion: screen.version ?? 1, screen: toInput(screen) },
      });
      if (result.status === "not-found") {
        if (!deleting.has(id)) toast.error(`"${screen.name}" was deleted by someone else.`);
        forget(id);
        return;
      }
      if (result.status === "conflict") {
        const lostEdits = (revisions.get(id) ?? 0) !== revision;
        replaceScreen(result.screen);
        revisions.set(id, (revisions.get(id) ?? 0) + 1);
        setStatus(id, "saved");
        toast.warning(
          `Someone else saved "${screen.name}" while you were editing. You're now looking at their version` +
            (lostEdits ? "; your last few changes were not saved." : "."),
        );
        return;
      }
      const current = get().screens.find((s) => s.id === id);
      if (current) {
        replaceScreen({
          ...current,
          version: result.screen.version,
          updatedAt: result.screen.updatedAt,
        });
      }
      setStatus(id, "saved");
    } catch (error) {
      setStatus(id, "error");
      toast.error(`Couldn't save "${screen.name}": ${errorMessage(error)}`, {
        action: { label: "Retry", onClick: () => void save(id) },
      });
      return;
    } finally {
      inFlight.delete(id);
    }
    // Edited again while that save was in flight: save once more, from the new version.
    if ((revisions.get(id) ?? 0) !== revision) scheduleSave(id);
  }

  function scheduleSave(id: string): void {
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
    revisions.set(id, (revisions.get(id) ?? 0) + 1);
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
        // Not marked hydrated: an empty list here would read as "you have no screens".
        set({ loadError: errorMessage(error) });
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
      deleting.add(id);
      clearTimeout(timers.get(id));
      timers.delete(id);
      try {
        await deleteScreenFn({ data: { id } });
        forget(id);
      } finally {
        deleting.delete(id);
      }
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
      // The import has happened on the server whatever happens next; a failed
      // refresh must not make it look as if it has not (and invite a second one).
      try {
        set({ screens: await listScreensFn(), hydrated: true, loadError: null });
      } catch {
        set({ hydrated: false });
        void get().hydrate();
      }
      return { imported: result.imported, failed: result.failed.map((f) => f.name) };
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
