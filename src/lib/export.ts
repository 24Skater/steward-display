import type { Screen, Settings } from "@/types";

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
  return candidate as Partial<Settings>;
}