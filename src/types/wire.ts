import type { Screen, WidgetInstance } from "./index";

/**
 * JSON, spelled out. Server functions must return types TanStack can prove are
 * serialisable, and `Record<string, unknown>` (a widget's config) is not one.
 * The wire types below are the client types with `unknown` narrowed to JSON;
 * they are assignable back to the client types without a cast.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type WireWidget = Omit<WidgetInstance, "config"> & { config: { [key: string]: Json } };

export type WireScreen = Omit<Screen, "widgets"> & { widgets: WireWidget[]; version: number };

export interface WirePreset {
  id: string;
  widgetType: string;
  label: string;
  description?: string;
  config: { [key: string]: Json };
  style?: WidgetInstance["style"];
  createdAt: string;
}

/** For values that came out of the database as JSON a server schema produced. */
export function asWire<T>(value: unknown): T {
  return value as T;
}
