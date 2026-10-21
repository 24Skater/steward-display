import type { WidgetInstance, WidgetType } from "@/types";
import { getWidgetDefinition } from "./widgetRegistry";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export interface LayoutSeed {
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  preview: { x: number; y: number; w: number; h: number; label: string }[];
  seeds: LayoutSeed[];
}

// Canvas is 24 cols × 16 rows.
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "single",
    name: "Single focus",
    description: "One large announcement, full canvas.",
    preview: [{ x: 1, y: 1, w: 22, h: 14, label: "Hero" }],
    seeds: [{ type: "announcement", x: 2, y: 4, w: 20, h: 8 }],
  },
  {
    id: "header-grid",
    name: "Header + grid",
    description: "Clock & date on top, content grid below.",
    preview: [
      { x: 0, y: 0, w: 14, h: 4, label: "Clock" },
      { x: 14, y: 0, w: 10, h: 4, label: "Date" },
      { x: 0, y: 4, w: 24, h: 12, label: "Announcement" },
    ],
    seeds: [
      { type: "clock", x: 0, y: 0, w: 14, h: 4 },
      { type: "date", x: 14, y: 0, w: 10, h: 4 },
      { type: "announcement", x: 1, y: 6, w: 22, h: 8 },
    ],
  },
  {
    id: "two-up",
    name: "2-Up split",
    description: "Two equal columns side by side.",
    preview: [
      { x: 0, y: 0, w: 12, h: 16, label: "Left" },
      { x: 12, y: 0, w: 12, h: 16, label: "Right" },
    ],
    seeds: [
      { type: "scripture", x: 0, y: 2, w: 12, h: 12 },
      { type: "event-list", x: 12, y: 2, w: 12, h: 12 },
    ],
  },
  {
    id: "three-up",
    name: "3-Up cards",
    description: "Three columns: time, message, weather.",
    preview: [
      { x: 0, y: 0, w: 8, h: 16, label: "Time" },
      { x: 8, y: 0, w: 8, h: 16, label: "Message" },
      { x: 16, y: 0, w: 8, h: 16, label: "Weather" },
    ],
    seeds: [
      { type: "clock", x: 0, y: 4, w: 8, h: 4 },
      { type: "date", x: 0, y: 8, w: 8, h: 3 },
      { type: "announcement", x: 8, y: 4, w: 8, h: 8 },
      { type: "weather", x: 16, y: 4, w: 8, h: 8 },
    ],
  },
  {
    id: "sidebar",
    name: "Sidebar + main",
    description: "Narrow info column with a main content area.",
    preview: [
      { x: 0, y: 0, w: 7, h: 16, label: "Sidebar" },
      { x: 7, y: 0, w: 17, h: 16, label: "Main" },
    ],
    seeds: [
      { type: "clock", x: 0, y: 1, w: 7, h: 4 },
      { type: "date", x: 0, y: 5, w: 7, h: 2 },
      { type: "event-list", x: 0, y: 8, w: 7, h: 7 },
      { type: "announcement", x: 7, y: 2, w: 17, h: 12 },
    ],
  },
  {
    id: "quad",
    name: "Quad grid",
    description: "Four equal quadrants for varied content.",
    preview: [
      { x: 0, y: 0, w: 12, h: 8, label: "TL" },
      { x: 12, y: 0, w: 12, h: 8, label: "TR" },
      { x: 0, y: 8, w: 12, h: 8, label: "BL" },
      { x: 12, y: 8, w: 12, h: 8, label: "BR" },
    ],
    seeds: [
      { type: "clock", x: 0, y: 1, w: 12, h: 6 },
      { type: "weather", x: 12, y: 1, w: 12, h: 6 },
      { type: "scripture", x: 0, y: 9, w: 12, h: 6 },
      { type: "giving-progress", x: 12, y: 9, w: 12, h: 6 },
    ],
  },
];

export function instantiateTemplate(template: LayoutTemplate): WidgetInstance[] {
  return template.seeds.map((seed) => {
    const def = getWidgetDefinition(seed.type);
    return {
      id: uid(),
      widgetType: seed.type,
      x: seed.x,
      y: seed.y,
      w: seed.w,
      h: seed.h,
      config: { ...(def?.defaultConfig ?? {}), ...(seed.config ?? {}) },
    };
  });
}
