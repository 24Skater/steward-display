import { z } from "zod";
import type { Screen, Settings } from "@/types";

const GRID_SIZE_OPTIONS = [1, 2, 4, 6, 8, 12, 16] as const;
const DEFAULT_GRID_SIZE = 1;
const DEFAULT_SNAP_STEP = 4;

const isValidGridValue = (v: number) =>
  (GRID_SIZE_OPTIONS as readonly number[]).includes(v);

const otherSettingsSchema = z.object({
  orgName: z.string().optional(),
  timezone: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  defaultOrientation: z.enum(["landscape", "portrait"]).optional(),
  defaultBackground: z.string().optional(),
  weatherApiKey: z.string().optional(),
});

function validateGridField(
  candidate: Record<string, unknown>,
  field: "defaultGridSize" | "defaultSnapStep",
  defaultValue: number,
): { value?: number; warning?: string } {
  if (!(field in candidate)) return {};
  const raw = candidate[field];
  const result = z
    .number()
    .int()
    .refine(isValidGridValue, { message: `Invalid ${field}` })
    .safeParse(raw);
  if (result.success) {
    return { value: result.data };
  }
  return {
    value: defaultValue,
    warning: `${field} (${JSON.stringify(raw)}) is invalid; falling back to ${defaultValue}.`,
  };
}

export function parseImportedSettings(text: string): { settings: Partial<Settings>; warnings: string[] } {
  const parsed = JSON.parse(text);
  const candidate =
    parsed && typeof parsed === "object" && parsed.settings && typeof parsed.settings === "object"
      ? parsed.settings
      : parsed;
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Invalid settings file.");
  }

  const record = candidate as Record<string, unknown>;
  const warnings: string[] = [];
  const settings: Partial<Settings> = {};

  const gridSize = validateGridField(record, "defaultGridSize", DEFAULT_GRID_SIZE);
  if (gridSize.warning) warnings.push(gridSize.warning);
  if (gridSize.value !== undefined) settings.defaultGridSize = gridSize.value;

  const snapStep = validateGridField(record, "defaultSnapStep", DEFAULT_SNAP_STEP);
  if (snapStep.warning) warnings.push(snapStep.warning);
  if (snapStep.value !== undefined) settings.defaultSnapStep = snapStep.value;

  const otherFields = {
    orgName: record.orgName,
    timezone: record.timezone,
    theme: record.theme,
    defaultOrientation: record.defaultOrientation,
    defaultBackground: record.defaultBackground,
    weatherApiKey: record.weatherApiKey,
  };
  Object.assign(settings, otherSettingsSchema.parse(otherFields));

  return { settings, warnings };
}

