export type WidgetType =
  | "clock"
  | "date"
  | "announcement"
  | "countdown"
  | "scripture"
  | "weather"
  | "image"
  | "video"
  | "giving-progress"
  | "event-list"
  | "divider"
  | "text";

export type WidgetCategory = "Time" | "Content" | "Media" | "Data" | "Layout";

export interface WidgetStyle {
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  opacity?: number;
}

export interface WidgetInstance {
  id: string;
  widgetType: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
  style?: WidgetStyle;
}

export interface Schedule {
  enabled: boolean;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  timezone: string;
}

export type ScreenResolution = "1920x1080" | "1280x720" | "3840x2160" | "custom";

export interface Screen {
  id: string;
  name: string;
  description?: string;
  orientation: "landscape" | "portrait";
  resolution: ScreenResolution;
  customWidth?: number;
  customHeight?: number;
  backgroundColor: string;
  backgroundImage?: string;
  showWatermark?: boolean;
  widgets: WidgetInstance[];
  schedule?: Schedule;
  gridSize?: number;
  snapStep?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  orgName: string;
  timezone: string;
  theme: "light" | "dark";
  defaultOrientation: "landscape" | "portrait";
  defaultBackground: string;
  weatherApiKey?: string;
  defaultGridSize: number;
  defaultSnapStep: number;
  maxGridHistorySize: number;
  gridImportIncludeDefaults?: boolean;
  gridImportIncludeHistory?: boolean;
  lastGridImport?: {
    timestamp: number;
    mode: "merge" | "replace";
    includedDefaults: boolean;
    includedHistory: boolean;
  };
}

export const RESOLUTION_DIMENSIONS: Record<
  Exclude<ScreenResolution, "custom">,
  { w: number; h: number }
> = {
  "1920x1080": { w: 1920, h: 1080 },
  "1280x720": { w: 1280, h: 720 },
  "3840x2160": { w: 3840, h: 2160 },
};

export function getScreenDimensions(s: Screen): { w: number; h: number } {
  if (s.resolution === "custom") {
    const w = s.customWidth ?? 1920;
    const h = s.customHeight ?? 1080;
    return s.orientation === "portrait" ? { w: Math.min(w, h), h: Math.max(w, h) } : { w, h };
  }
  const dims = RESOLUTION_DIMENSIONS[s.resolution];
  return s.orientation === "portrait" ? { w: dims.h, h: dims.w } : dims;
}
