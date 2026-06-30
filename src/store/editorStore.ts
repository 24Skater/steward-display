import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WidgetInstance } from "@/types";

export interface DragPreview {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EditorState {
  selectedIds: string[];
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  snapStep: number;
  gridSize: number;
  showAlignment: boolean;
  showRulers: boolean;
  dragPreview: DragPreview | null;
  history: WidgetInstance[][];
  future: WidgetInstance[][];
  select: (ids: string[]) => void;
  toggleSelect: (id: string, additive: boolean) => void;
  setZoom: (z: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setSnapStep: (n: number) => void;
  setGridSize: (n: number) => void;
  toggleAlignment: () => void;
  toggleRulers: () => void;
  setDragPreview: (p: DragPreview | null) => void;
  pushHistory: (snapshot: WidgetInstance[]) => void;
  undo: () => WidgetInstance[] | null;
  redo: () => WidgetInstance[] | null;
  reset: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
  selectedIds: [],
  zoom: 0.5,
  showGrid: true,
  snapToGrid: false,
  snapStep: 4,
  gridSize: 1,
  showAlignment: false,
  showRulers: true,
  dragPreview: null,
  history: [],
  future: [],
  select: (ids) => set({ selectedIds: ids }),
  toggleSelect: (id, additive) => {
    const current = get().selectedIds;
    if (additive) {
      set({
        selectedIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      });
    } else {
      set({ selectedIds: [id] });
    }
  },
  setZoom: (zoom) => set({ zoom }),
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  toggleSnap: () => set({ snapToGrid: !get().snapToGrid }),
  setSnapStep: (n) => set({ snapStep: Math.max(1, Math.min(32, Math.round(n))) }),
  setGridSize: (n) => set({ gridSize: Math.max(1, Math.min(32, Math.round(n))) }),
  toggleAlignment: () => set({ showAlignment: !get().showAlignment }),
  toggleRulers: () => set({ showRulers: !get().showRulers }),
  setDragPreview: (p) => set({ dragPreview: p }),
  pushHistory: (snapshot) => {
    const next = [...get().history, snapshot].slice(-50);
    set({ history: next, future: [] });
  },
  undo: () => {
    const h = get().history;
    if (!h.length) return null;
    const prev = h[h.length - 1];
    set({ history: h.slice(0, -1), future: [prev, ...get().future] });
    return prev;
  },
  redo: () => {
    const f = get().future;
    if (!f.length) return null;
    const next = f[0];
    set({ future: f.slice(1), history: [...get().history, next] });
    return next;
  },
  reset: () => set({ selectedIds: [], history: [], future: [], dragPreview: null }),
    }),
    {
      name: "steward.editor",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        showGrid: s.showGrid,
        showAlignment: s.showAlignment,
        showRulers: s.showRulers,
        snapToGrid: s.snapToGrid,
      }),
    },
  ),
);
