import type { ComponentType } from "react";
import {
  Clock,
  Calendar,
  Megaphone,
  Timer,
  BookOpen,
  CloudSun,
  Image as ImageIcon,
  Video,
  HandCoins,
  ListChecks,
  Minus,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import type { WidgetCategory, WidgetType } from "@/types";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { DateWidget } from "@/components/widgets/DateWidget";
import { AnnouncementWidget } from "@/components/widgets/AnnouncementWidget";
import { CountdownWidget } from "@/components/widgets/CountdownWidget";
import { ScriptureWidget } from "@/components/widgets/ScriptureWidget";
import { TextWidget } from "@/components/widgets/TextWidget";
import { ImageWidget } from "@/components/widgets/ImageWidget";
import { VideoWidget } from "@/components/widgets/VideoWidget";
import { DividerWidget } from "@/components/widgets/DividerWidget";
import { GivingProgressWidget } from "@/components/widgets/GivingProgressWidget";
import { EventListWidget } from "@/components/widgets/EventListWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  description: string;
  category: WidgetCategory;
  icon: LucideIcon;
  defaultSize: { w: number; h: number };
  defaultConfig: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- per-widget config is untyped until the P1 widget schema lands
  Component: ComponentType<{ config: any }>;
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "clock",
    label: "Clock",
    description: "Live time display, ticks every second.",
    category: "Time",
    icon: Clock,
    defaultSize: { w: 8, h: 4 },
    defaultConfig: { format24h: false, showSeconds: false },
    Component: ClockWidget,
  },
  {
    type: "date",
    label: "Date",
    description: "Today's date in a clean format.",
    category: "Time",
    icon: Calendar,
    defaultSize: { w: 8, h: 2 },
    defaultConfig: { format: "full" },
    Component: DateWidget,
  },
  {
    type: "countdown",
    label: "Countdown",
    description: "Counts down to an event.",
    category: "Time",
    icon: Timer,
    defaultSize: { w: 10, h: 4 },
    defaultConfig: { target: "", label: "Service begins in", units: ["days", "hours", "minutes"] },
    Component: CountdownWidget,
  },
  {
    type: "announcement",
    label: "Announcement",
    description: "Title and body for important notices.",
    category: "Content",
    icon: Megaphone,
    defaultSize: { w: 12, h: 4 },
    defaultConfig: { title: "Welcome", body: "We're glad you're here.", align: "center" },
    Component: AnnouncementWidget,
  },
  {
    type: "scripture",
    label: "Scripture",
    description: "Display a verse and reference.",
    category: "Content",
    icon: BookOpen,
    defaultSize: { w: 12, h: 5 },
    defaultConfig: { text: "", reference: "", version: "" },
    Component: ScriptureWidget,
  },
  {
    type: "text",
    label: "Text",
    description: "Free-form text block.",
    category: "Content",
    icon: TypeIcon,
    defaultSize: { w: 8, h: 3 },
    defaultConfig: { text: "", align: "left" },
    Component: TextWidget,
  },
  {
    type: "image",
    label: "Image",
    description: "Show an image from URL.",
    category: "Media",
    icon: ImageIcon,
    defaultSize: { w: 8, h: 6 },
    defaultConfig: { src: "", fit: "cover", alt: "" },
    Component: ImageWidget,
  },
  {
    type: "video",
    label: "Video",
    description: "Looping background video.",
    category: "Media",
    icon: Video,
    defaultSize: { w: 10, h: 6 },
    defaultConfig: { src: "", muted: true, loop: true },
    Component: VideoWidget,
  },
  {
    type: "giving-progress",
    label: "Giving progress",
    description: "Progress bar toward a giving goal.",
    category: "Data",
    icon: HandCoins,
    defaultSize: { w: 10, h: 4 },
    defaultConfig: { label: "Building fund", goal: 0, current: 0, accent: "#16A34A" },
    Component: GivingProgressWidget,
  },
  {
    type: "event-list",
    label: "Event list",
    description: "Upcoming events list.",
    category: "Data",
    icon: ListChecks,
    defaultSize: { w: 10, h: 6 },
    defaultConfig: { title: "This week", events: [] },
    Component: EventListWidget,
  },
  {
    type: "weather",
    label: "Weather",
    description: "Current conditions (needs API key).",
    category: "Data",
    icon: CloudSun,
    defaultSize: { w: 6, h: 4 },
    defaultConfig: { city: "" },
    Component: WeatherWidget,
  },
  {
    type: "divider",
    label: "Divider",
    description: "Horizontal or vertical line.",
    category: "Layout",
    icon: Minus,
    defaultSize: { w: 12, h: 1 },
    defaultConfig: { orientation: "horizontal", thickness: 2, opacity: 0.5 },
    Component: DividerWidget,
  },
];

const REGISTRY: Record<WidgetType, WidgetDefinition> = WIDGET_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.type] = def;
    return acc;
  },
  {} as Record<WidgetType, WidgetDefinition>,
);

export function getWidgetDefinition(type: WidgetType): WidgetDefinition | undefined {
  return REGISTRY[type];
}

export const WIDGET_CATEGORIES: WidgetCategory[] = ["Time", "Content", "Media", "Data", "Layout"];
