/**
 * WCAG 2.1 contrast utilities + Steward brand token pairing audit.
 *
 * Hex values mirror `src/styles.css`. Keep in sync when tokens change.
 * Thresholds: AA normal text ≥ 4.5, AA large text / UI / non-text ≥ 3.0,
 * AAA normal ≥ 7.0.
 */

export type ContrastUse = "body" | "large" | "ui" | "decorative";

/**
 * Per-use minimum contrast ratios + escalation flags.
 *
 * Resolution order (highest precedence first), applied by `loadContrastConfig`:
 *   1. Env vars (CONTRAST_BODY, CONTRAST_LARGE, CONTRAST_UI, CONTRAST_DECORATIVE,
 *      CONTRAST_REQUIRE_AAA, CONTRAST_FAIL_ON_DECORATIVE)
 *   2. JSON file at $CONTRAST_CONFIG or ./contrast.config.json
 *   3. WCAG 2.1 AA defaults
 */
export type ContrastConfig = {
  thresholds: Record<ContrastUse, number>;
  /** When true, evaluate against AAA targets (body 7, others 4.5) instead of AA. */
  requireAAA: boolean;
  /** When true, decorative pairings count as failures too. */
  failOnDecorative: boolean;
};

export const DEFAULT_CONTRAST_CONFIG: ContrastConfig = {
  thresholds: { body: 4.5, large: 3.0, ui: 3.0, decorative: 1.5 },
  requireAAA: false,
  failOnDecorative: false,
};

const AAA_THRESHOLDS: Record<ContrastUse, number> = {
  body: 7.0,
  large: 4.5,
  ui: 4.5,
  decorative: 1.5,
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function expand(hex: string): string {
  const m = hex.trim();
  if (!HEX.test(m)) throw new Error(`Invalid hex: ${hex}`);
  if (m.length === 4) {
    return "#" + [m[1], m[2], m[3]].map((c) => c + c).join("");
  }
  return m.toLowerCase();
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const h = expand(hex).slice(1);
  const r = srgbToLinear(parseInt(h.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(h.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

export function wcagThreshold(
  use: ContrastUse,
  config: ContrastConfig = DEFAULT_CONTRAST_CONFIG,
): number {
  const base = (config.requireAAA ? AAA_THRESHOLDS : config.thresholds)[use];
  return base ?? DEFAULT_CONTRAST_CONFIG.thresholds[use];
}

export type PairResult = {
  name: string;
  fg: string;
  bg: string;
  fgVar: string;
  bgVar: string;
  use: ContrastUse;
  ratio: number;
  threshold: number;
  passAA: boolean;
  passAAA: boolean;
  /** True only when the pair's outcome should fail CI under the active config. */
  required: boolean;
  theme: "light" | "dark";
};

type PairDef = {
  name: string;
  fg: string;
  bg: string;
  use: ContrastUse;
  /** CSS custom property the foreground color is bound to in src/styles.css. */
  fgVar: string;
  /** CSS custom property the background color is bound to in src/styles.css. */
  bgVar: string;
};

const p = (
  name: string,
  fg: string,
  bg: string,
  use: ContrastUse,
  fgVar: string,
  bgVar: string,
): PairDef => ({ name, fg, bg, use, fgVar, bgVar });

// Brand tokens — single source of truth for the audit.
const LIGHT = {
  parchment: "#faf7f2",
  warmSurface: "#f5eed8",
  surface: "#ffffff",
  navy: "#1b2a41",
  navyDeep: "#0d1b2e",
  gold: "#e8b847",
  goldDark: "#c49a2e",
  blue: "#2563eb",
  ink: "#0d1b2e",
  mutedFg: "#57647a",
  border: "#b8a778",
  emerald: "#15803d",
  red: "#dc2626",
  amber: "#f59e0b",
  white: "#ffffff",
} as const;

const DARK = {
  bg: "#060f1a",
  surface: "#0d1b2e",
  secondary: "#1e2f4a",
  parchmentText: "#f5eed8",
  mutedFg: "#a89878",
  border: "#3d5878",
  gold: "#e8b847",
  blue: "#2563eb",
  emerald: "#16a34a",
  red: "#dc2626",
  navy: "#1b2a41",
} as const;

export const LIGHT_PAIRS: PairDef[] = [
  p("Body text on parchment", LIGHT.ink, LIGHT.parchment, "body", "--ink", "--parchment"),
  p("Body text on white card", LIGHT.ink, LIGHT.surface, "body", "--ink", "--surface"),
  p("Body text on warm surface", LIGHT.ink, LIGHT.warmSurface, "body", "--ink", "--warm-surface"),
  p("Muted text on parchment", LIGHT.mutedFg, LIGHT.parchment, "body", "--muted-fg", "--parchment"),
  p("Muted text on white card", LIGHT.mutedFg, LIGHT.surface, "body", "--muted-fg", "--surface"),
  p(
    "Navy text on Kingdom Gold (primary)",
    LIGHT.navy,
    LIGHT.gold,
    "body",
    "--primary-foreground",
    "--primary",
  ),
  p(
    "Navy text on gold-dark hover",
    LIGHT.navy,
    LIGHT.goldDark,
    "body",
    "--primary-foreground",
    "--gold-dark",
  ),
  p(
    "Parchment text on navy sidebar",
    LIGHT.warmSurface,
    LIGHT.navy,
    "body",
    "--sidebar-foreground",
    "--sidebar",
  ),
  p(
    "White text on Steward Blue",
    LIGHT.white,
    LIGHT.blue,
    "body",
    "--primary-foreground",
    "--blue",
  ),
  p("Blue link on parchment", LIGHT.blue, LIGHT.parchment, "body", "--blue", "--parchment"),
  p("Blue link on white card", LIGHT.blue, LIGHT.surface, "body", "--blue", "--surface"),
  p(
    "White text on emerald (success)",
    LIGHT.white,
    LIGHT.emerald,
    "body",
    "--destructive-foreground",
    "--emerald",
  ),
  p(
    "White text on red (destructive)",
    LIGHT.white,
    LIGHT.red,
    "body",
    "--destructive-foreground",
    "--destructive",
  ),
  p(
    "Navy text on amber (warning)",
    LIGHT.navy,
    LIGHT.amber,
    "body",
    "--primary-foreground",
    "--amber",
  ),
  p(
    "Warm border vs parchment (decorative)",
    LIGHT.border,
    LIGHT.parchment,
    "decorative",
    "--border",
    "--parchment",
  ),
  p("Focus ring (blue) vs parchment", LIGHT.blue, LIGHT.parchment, "ui", "--ring", "--parchment"),
  p("Gold focus ring vs navy sidebar", LIGHT.gold, LIGHT.navy, "ui", "--sidebar-ring", "--sidebar"),
];

export const DARK_PAIRS: PairDef[] = [
  p("Body text on dark bg", DARK.parchmentText, DARK.bg, "body", "--foreground", "--background"),
  p(
    "Body text on dark surface",
    DARK.parchmentText,
    DARK.surface,
    "body",
    "--foreground",
    "--surface",
  ),
  p(
    "Body text on dark secondary",
    DARK.parchmentText,
    DARK.secondary,
    "body",
    "--foreground",
    "--secondary",
  ),
  p("Muted text on dark bg", DARK.mutedFg, DARK.bg, "body", "--muted-fg", "--background"),
  p("Muted text on dark surface", DARK.mutedFg, DARK.surface, "body", "--muted-fg", "--surface"),
  p(
    "Navy text on Kingdom Gold (primary)",
    DARK.navy,
    DARK.gold,
    "body",
    "--primary-foreground",
    "--primary",
  ),
  p("Gold link on dark bg", DARK.gold, DARK.bg, "body", "--primary", "--background"),
  p("Gold link on dark surface", DARK.gold, DARK.surface, "body", "--primary", "--surface"),
  p("Blue accent on dark surface", DARK.blue, DARK.surface, "large", "--blue", "--surface"),
  p(
    "Border vs dark bg (decorative)",
    DARK.border,
    DARK.bg,
    "decorative",
    "--border",
    "--background",
  ),
  p("Gold focus ring vs dark bg", DARK.gold, DARK.bg, "ui", "--ring", "--background"),
];

export function evaluatePair(
  p: PairDef,
  theme: "light" | "dark",
  config: ContrastConfig = DEFAULT_CONTRAST_CONFIG,
): PairResult {
  const ratio = contrastRatio(p.fg, p.bg);
  const threshold = wcagThreshold(p.use, config);
  const aaaTarget = AAA_THRESHOLDS[p.use];
  return {
    ...p,
    theme,
    ratio,
    threshold,
    passAA: ratio >= threshold,
    passAAA: ratio >= aaaTarget,
    required: p.use !== "decorative" || config.failOnDecorative,
  };
}

export function auditBrandContrast(config: ContrastConfig = DEFAULT_CONTRAST_CONFIG): PairResult[] {
  return [
    ...LIGHT_PAIRS.map((p) => evaluatePair(p, "light", config)),
    ...DARK_PAIRS.map((p) => evaluatePair(p, "dark", config)),
  ];
}

/** Dev-only warning: logs every failing pair to the console once. */
let warned = false;
export function warnOnContrastFailures(): void {
  if (warned || typeof console === "undefined") return;
  warned = true;
  const failures = auditBrandContrast().filter((r) => r.required && !r.passAA);
  if (!failures.length) {
    console.info(
      "%c[Steward contrast] All brand token pairings pass WCAG AA.",
      "color:#16a34a;font-weight:600;",
    );
    return;
  }
  console.groupCollapsed(
    `%c[Steward contrast] ${failures.length} pairing(s) fail WCAG AA`,
    "color:#dc2626;font-weight:600;",
  );
  for (const f of failures) {
    console.warn(`${f.theme} · ${f.name} — ${f.ratio.toFixed(2)}:1 (needs ${f.threshold}:1)`, {
      fg: f.fg,
      bg: f.bg,
      use: f.use,
    });
  }
  console.groupEnd();
}
