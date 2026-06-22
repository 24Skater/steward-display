/**
 * WCAG 2.1 contrast utilities + Steward brand token pairing audit.
 *
 * Hex values mirror `src/styles.css`. Keep in sync when tokens change.
 * Thresholds: AA normal text ≥ 4.5, AA large text / UI / non-text ≥ 3.0,
 * AAA normal ≥ 7.0.
 */

export type ContrastUse = "body" | "large" | "ui" | "decorative";

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

export function wcagThreshold(use: ContrastUse): number {
  if (use === "body") return 4.5;
  if (use === "decorative") return 1.5; // informational only
  return 3.0;
}

export type PairResult = {
  name: string;
  fg: string;
  bg: string;
  use: ContrastUse;
  ratio: number;
  threshold: number;
  passAA: boolean;
  passAAA: boolean;
  theme: "light" | "dark";
};

type PairDef = { name: string; fg: string; bg: string; use: ContrastUse };

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
  { name: "Body text on parchment", fg: LIGHT.ink, bg: LIGHT.parchment, use: "body" },
  { name: "Body text on white card", fg: LIGHT.ink, bg: LIGHT.surface, use: "body" },
  { name: "Body text on warm surface", fg: LIGHT.ink, bg: LIGHT.warmSurface, use: "body" },
  { name: "Muted text on parchment", fg: LIGHT.mutedFg, bg: LIGHT.parchment, use: "body" },
  { name: "Muted text on white card", fg: LIGHT.mutedFg, bg: LIGHT.surface, use: "body" },
  { name: "Navy text on Kingdom Gold (primary)", fg: LIGHT.navy, bg: LIGHT.gold, use: "body" },
  { name: "Navy text on gold-dark hover", fg: LIGHT.navy, bg: LIGHT.goldDark, use: "body" },
  { name: "Parchment text on navy sidebar", fg: LIGHT.warmSurface, bg: LIGHT.navy, use: "body" },
  { name: "White text on Steward Blue", fg: LIGHT.white, bg: LIGHT.blue, use: "body" },
  { name: "Blue link on parchment", fg: LIGHT.blue, bg: LIGHT.parchment, use: "body" },
  { name: "Blue link on white card", fg: LIGHT.blue, bg: LIGHT.surface, use: "body" },
  { name: "White text on emerald (success)", fg: LIGHT.white, bg: LIGHT.emerald, use: "body" },
  { name: "White text on red (destructive)", fg: LIGHT.white, bg: LIGHT.red, use: "body" },
  { name: "Navy text on amber (warning)", fg: LIGHT.navy, bg: LIGHT.amber, use: "body" },
  { name: "Warm border vs parchment (decorative)", fg: LIGHT.border, bg: LIGHT.parchment, use: "decorative" },
  { name: "Focus ring (blue) vs parchment", fg: LIGHT.blue, bg: LIGHT.parchment, use: "ui" },
  { name: "Gold focus ring vs navy sidebar", fg: LIGHT.gold, bg: LIGHT.navy, use: "ui" },
];

export const DARK_PAIRS: PairDef[] = [
  { name: "Body text on dark bg", fg: DARK.parchmentText, bg: DARK.bg, use: "body" },
  { name: "Body text on dark surface", fg: DARK.parchmentText, bg: DARK.surface, use: "body" },
  { name: "Body text on dark secondary", fg: DARK.parchmentText, bg: DARK.secondary, use: "body" },
  { name: "Muted text on dark bg", fg: DARK.mutedFg, bg: DARK.bg, use: "body" },
  { name: "Muted text on dark surface", fg: DARK.mutedFg, bg: DARK.surface, use: "body" },
  { name: "Navy text on Kingdom Gold (primary)", fg: DARK.navy, bg: DARK.gold, use: "body" },
  { name: "Gold link on dark bg", fg: DARK.gold, bg: DARK.bg, use: "body" },
  { name: "Gold link on dark surface", fg: DARK.gold, bg: DARK.surface, use: "body" },
  { name: "Blue accent on dark surface", fg: DARK.blue, bg: DARK.surface, use: "large" },
  { name: "Border vs dark bg (decorative)", fg: DARK.border, bg: DARK.bg, use: "decorative" },
  { name: "Gold focus ring vs dark bg", fg: DARK.gold, bg: DARK.bg, use: "ui" },
];

export function evaluatePair(p: PairDef, theme: "light" | "dark"): PairResult {
  const ratio = contrastRatio(p.fg, p.bg);
  const threshold = wcagThreshold(p.use);
  return {
    ...p,
    theme,
    ratio,
    threshold,
    passAA: ratio >= threshold,
    passAAA: ratio >= (p.use === "body" ? 7 : 4.5),
  };
}

export function auditBrandContrast(): PairResult[] {
  return [
    ...LIGHT_PAIRS.map((p) => evaluatePair(p, "light")),
    ...DARK_PAIRS.map((p) => evaluatePair(p, "dark")),
  ];
}

/** Dev-only warning: logs every failing pair to the console once. */
let warned = false;
export function warnOnContrastFailures(): void {
  if (warned || typeof console === "undefined") return;
  warned = true;
  const failures = auditBrandContrast().filter((r) => !r.passAA);
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
    console.warn(
      `${f.theme} · ${f.name} — ${f.ratio.toFixed(2)}:1 (needs ${f.threshold}:1)`,
      { fg: f.fg, bg: f.bg, use: f.use },
    );
  }
  console.groupEnd();
}