import type { WidgetInstance } from "@/types";

export type WidgetPreset = {
  id: string;
  label: string;
  description?: string;
  config?: Record<string, unknown>;
  style?: NonNullable<WidgetInstance["style"]>;
};

export const WIDGET_PRESETS: Record<string, WidgetPreset[]> = {
  clock: [
    {
      id: "digital-12",
      label: "12-hour digital",
      description: "AM/PM, no seconds",
      config: { format24h: false, showSeconds: false },
    },
    {
      id: "digital-24",
      label: "24-hour digital",
      description: "Military time",
      config: { format24h: true, showSeconds: false },
    },
    {
      id: "precise",
      label: "With seconds",
      description: "Live ticking display",
      config: { format24h: false, showSeconds: true },
    },
  ],
  date: [
    { id: "full", label: "Full weekday", config: { format: "full" } },
    { id: "long", label: "Long", config: { format: "long" } },
    { id: "short", label: "Compact", config: { format: "short" } },
  ],
  announcement: [
    {
      id: "welcome",
      label: "Welcome",
      description: "Centered greeting",
      config: { title: "Welcome!", body: "We're so glad you're here today.", align: "center" },
      style: { backgroundColor: "#0B1220", textColor: "#FFFFFF", borderRadius: "16px" },
    },
    {
      id: "next-service",
      label: "Next service",
      config: { title: "Next Service", body: "", align: "center" },
    },
    {
      id: "alert",
      label: "Alert banner",
      description: "High-contrast warning",
      config: { title: "Heads up", body: "", align: "left" },
      style: { backgroundColor: "#DC2626", textColor: "#FFFFFF", borderRadius: "8px" },
    },
  ],
  countdown: [
    { id: "service-start", label: "Service starts", config: { label: "Service starts in" } },
    { id: "event", label: "Event countdown", config: { label: "Doors open in" } },
  ],
  scripture: [
    {
      id: "john-316",
      label: "John 3:16",
      config: {
        text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
        reference: "John 3:16",
        version: "ESV",
      },
    },
    {
      id: "psalm-23",
      label: "Psalm 23:1",
      config: {
        text: "The Lord is my shepherd; I shall not want.",
        reference: "Psalm 23:1",
        version: "ESV",
      },
    },
  ],
  text: [
    {
      id: "heading",
      label: "Heading",
      config: { text: "", align: "center" },
      style: { textColor: "#FFFFFF" },
    },
    { id: "body", label: "Body paragraph", config: { text: "", align: "left" } },
    {
      id: "caption",
      label: "Caption",
      config: { text: "", align: "center" },
      style: { opacity: 0.7 },
    },
  ],
  image: [
    { id: "cover", label: "Cover (crop)", config: { fit: "cover" } },
    { id: "contain", label: "Contain (fit)", config: { fit: "contain" } },
  ],
  video: [
    {
      id: "background",
      label: "Background loop",
      description: "Muted, looping",
      config: { muted: true, loop: true },
    },
    { id: "featured", label: "Featured video", config: { muted: false, loop: false } },
  ],
  "giving-progress": [
    {
      id: "general",
      label: "General fund",
      config: { label: "General Fund", goal: 0, current: 0, accent: "#16A34A" },
    },
    {
      id: "building",
      label: "Building campaign",
      config: { label: "Building Campaign", goal: 0, current: 0, accent: "#2563EB" },
    },
    {
      id: "missions",
      label: "Missions",
      config: { label: "Missions", goal: 0, current: 0, accent: "#D97706" },
    },
  ],
  divider: [
    {
      id: "thin",
      label: "Thin",
      config: { orientation: "horizontal", thickness: 1, opacity: 0.4 },
    },
    {
      id: "bold",
      label: "Bold",
      config: { orientation: "horizontal", thickness: 6, opacity: 0.8 },
    },
    {
      id: "vertical",
      label: "Vertical",
      config: { orientation: "vertical", thickness: 2, opacity: 0.5 },
    },
  ],
  weather: [
    { id: "nashville", label: "Nashville, TN", config: { city: "Nashville, TN" } },
    { id: "ny", label: "New York, NY", config: { city: "New York, NY" } },
    { id: "la", label: "Los Angeles, CA", config: { city: "Los Angeles, CA" } },
  ],
  "event-list": [
    { id: "this-week", label: "This Week", config: { title: "This Week" } },
    { id: "upcoming", label: "Upcoming Events", config: { title: "Upcoming Events" } },
  ],
};

export function getPresetsForWidget(type: string): WidgetPreset[] {
  return WIDGET_PRESETS[type] ?? [];
}
