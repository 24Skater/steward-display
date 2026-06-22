import { create } from "zustand";
import type { WidgetInstance } from "@/types";

interface EditorState {
  selectedIds: string[];
  zoom: number;
  showGrid: boolean;
  history: WidgetInstance[][];
  future: WidgetInstance[][];
  select: (ids: string[]) => void;
  toggleSelect: (id: string, additive: boolean) => void;
  setZoom: (z: number) => void;
  toggleGrid: () => void;
  pushHistory: (snapshot: WidgetInstance[]) => void;
  undo: () => WidgetInstance[] | null;
  redo: () => WidgetInstance[] | null;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedIds: [],
  zoom: 0.5,
  showGrid: true,
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
  reset: () => set({ selectedIds: [], history: [], future: [] }),
}));