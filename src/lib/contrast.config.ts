/**
 * Node-only loader for ContrastConfig. Resolution order:
 *   1. Env vars override JSON file values.
 *   2. JSON file (path from $CONTRAST_CONFIG or ./contrast.config.json).
 *   3. WCAG 2.1 AA defaults from contrast.ts.
 *
 * Do NOT import from browser code — uses node:fs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONTRAST_CONFIG, type ContrastConfig, type ContrastUse } from "./contrast";

const USES: ContrastUse[] = ["body", "large", "ui", "decorative"];

function parseBool(v: string | undefined): boolean | undefined {
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return undefined;
}

function parseNum(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function readJsonConfig(cwd: string): {
  config: Partial<ContrastConfig> | null;
  path: string | null;
} {
  const explicit = process.env.CONTRAST_CONFIG;
  const candidates = [
    explicit && resolve(cwd, explicit),
    resolve(cwd, "contrast.config.json"),
  ].filter((p): p is string => typeof p === "string");

  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<ContrastConfig> & {
        thresholds?: Partial<Record<ContrastUse, number>>;
      };
      const thresholds = raw.thresholds
        ? Object.fromEntries(
            USES.map((u) => [
              u,
              typeof raw.thresholds![u] === "number" && raw.thresholds![u]! > 0
                ? raw.thresholds![u]!
                : DEFAULT_CONTRAST_CONFIG.thresholds[u],
            ]),
          )
        : undefined;
      return {
        config: {
          ...(thresholds && { thresholds: thresholds as Record<ContrastUse, number> }),
          ...(typeof raw.requireAAA === "boolean" && { requireAAA: raw.requireAAA }),
          ...(typeof raw.failOnDecorative === "boolean" && {
            failOnDecorative: raw.failOnDecorative,
          }),
        },
        path: p,
      };
    } catch (e) {
      throw new Error(`Could not parse contrast config at ${p}: ${(e as Error).message}`);
    }
  }
  return { config: null, path: null };
}

export type ResolvedContrastConfig = ContrastConfig & {
  source: {
    jsonPath: string | null;
    envOverrides: string[];
  };
};

export function loadContrastConfig(cwd: string = process.cwd()): ResolvedContrastConfig {
  const { config: fileCfg, path: jsonPath } = readJsonConfig(cwd);
  const envOverrides: string[] = [];

  const thresholds = { ...DEFAULT_CONTRAST_CONFIG.thresholds, ...(fileCfg?.thresholds ?? {}) };

  const envMap: Record<ContrastUse, string> = {
    body: "CONTRAST_BODY",
    large: "CONTRAST_LARGE",
    ui: "CONTRAST_UI",
    decorative: "CONTRAST_DECORATIVE",
  };
  for (const u of USES) {
    const v = parseNum(process.env[envMap[u]]);
    if (v != null) {
      thresholds[u] = v;
      envOverrides.push(envMap[u]);
    }
  }

  let requireAAA = fileCfg?.requireAAA ?? DEFAULT_CONTRAST_CONFIG.requireAAA;
  const envAAA = parseBool(process.env.CONTRAST_REQUIRE_AAA);
  if (envAAA != null) {
    requireAAA = envAAA;
    envOverrides.push("CONTRAST_REQUIRE_AAA");
  }

  let failOnDecorative = fileCfg?.failOnDecorative ?? DEFAULT_CONTRAST_CONFIG.failOnDecorative;
  const envDec = parseBool(process.env.CONTRAST_FAIL_ON_DECORATIVE);
  if (envDec != null) {
    failOnDecorative = envDec;
    envOverrides.push("CONTRAST_FAIL_ON_DECORATIVE");
  }

  return {
    thresholds,
    requireAAA,
    failOnDecorative,
    source: { jsonPath, envOverrides },
  };
}
