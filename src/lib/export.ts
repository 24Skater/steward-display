import type { Screen } from "@/types";

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