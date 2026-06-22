import { createServerFn } from "@tanstack/react-start";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type TokenLocation = {
  /** CSS custom property name including the leading -- */
  name: string;
  /** 1-based line number of the first definition. */
  line: number;
  /** Theme scope: ":root" → light, '.dark, [data-theme="dark"]' → dark. */
  scope: "light" | "dark" | "unknown";
  /** Raw value as written in styles.css (e.g. "#faf7f2" or "var(--navy)"). */
  value: string;
};

/**
 * Parses src/styles.css once per request and returns the line number + scope
 * for every CSS custom property in :root and the dark theme block. The audit
 * UI uses this to deep-link a failing token straight to its source line.
 */
export const getTokenLocations = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ tokens: Record<string, TokenLocation[]>; sourcePath: string }> => {
    const sourcePath = "src/styles.css";
    const text = readFileSync(resolve(process.cwd(), sourcePath), "utf8");
    const lines = text.split(/\r?\n/);

    const tokens: Record<string, TokenLocation[]> = {};
    let scope: "light" | "dark" | "unknown" = "unknown";
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      // Track block scope transitions on opening braces.
      const openIdx = raw.indexOf("{");
      if (openIdx >= 0 && depth === 0) {
        const selector = raw.slice(0, openIdx).trim();
        if (/^:root\b/.test(selector)) scope = "light";
        else if (/(^|,)\s*\.dark\b/.test(selector) || /\[data-theme="dark"\]/.test(selector))
          scope = "dark";
        else scope = "unknown";
      }
      depth += (raw.match(/\{/g) || []).length;
      depth -= (raw.match(/\}/g) || []).length;

      // Match a custom-property declaration at the top of the trimmed line.
      const m = line.match(/^(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/);
      if (m && (scope === "light" || scope === "dark")) {
        const [, name, value] = m;
        (tokens[name] ||= []).push({
          name,
          line: i + 1,
          scope,
          value: value.trim(),
        });
      }

      if (depth === 0) scope = "unknown";
    }

    return { tokens, sourcePath };
  },
);