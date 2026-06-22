import { z } from "zod";
import type { Screen, Settings } from "@/types";

const GRID_SIZE_OPTIONS = [1, 2, 4, 6, 8, 12, 16] as const;
const DEFAULT_GRID_SIZE = 1;
const DEFAULT_SNAP_STEP = 4;

const isValidGridValue = (v: number) =>
  (GRID_SIZE_OPTIONS as readonly number[]).includes(v);

const importedSettingsSchema = z.object({
  orgName: z.string().optional(),
  timezone: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  defaultOrientation: z.enum(["landscape", "portrait"]).optional(),
  defaultBackground: z.string().optional(),
  weatherApiKey: z.string().optional(),
  defaultGridSize: z
    .number()
    .int()
    .refine(isValidGridValue, { message: "Invalid default grid size" })
    .optional()
    .catch(DEFAULT_GRID_SIZE),
  defaultSnapStep: z
    .number()
    .int()
    .refine(isValidGridValue, { message: "Invalid default snap step" })
    .optional()
    .catch(DEFAULT_SNAP_STEP),
});

export function exportScreensToJSON(screens: Screen[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), screens }, null, 2);
}

export function downloadJSON(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedScreens(text: string): Screen[] {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed as Screen[];
  if (parsed && Array.isArray(parsed.screens)) return parsed.screens as Screen[];
  throw new Error("Invalid backup file. Expected a JSON array of screens.");
}

export function exportSettingsToJSON(settings: Settings): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), settings },
    null,
    2,
  );
}

export function parseImportedSettings(text: string): Partial<Settings> {
  const parsed = JSON.parse(text);
  const candidate =
    parsed && typeof parsed === "object" && parsed.settings && typeof parsed.settings === "object"
      ? parsed.settings
      : parsed;
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Invalid settings file.");
  }
  return importedSettingsSchema.parse(candidate) as Partial<Settings>;
}
