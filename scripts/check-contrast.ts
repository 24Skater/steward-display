#!/usr/bin/env bun
/**
 * CI gate: fail the build if any non-decorative brand token pairing
 * drops below its WCAG AA threshold.
 *
 * Run via `bun run check:contrast` or as a prebuild hook.
 */
import { auditBrandContrast } from "../src/lib/contrast";

const results = auditBrandContrast();
const required = results.filter((r) => r.use !== "decorative");
const failures = required.filter((r) => !r.passAA);

const pad = (s: string, n: number) => s.padEnd(n);

console.log(
  `Steward brand contrast audit · ${required.length} required pairing(s), ${
    results.length - required.length
  } decorative\n`,
);

for (const r of results) {
  const tag =
    r.use === "decorative"
      ? "INFO"
      : r.passAA
        ? r.passAAA
          ? "AAA "
          : "AA  "
        : "FAIL";
  const line = `  [${tag}] ${pad(r.theme, 5)} ${r.ratio
    .toFixed(2)
    .padStart(5)}:1  (≥${r.threshold}:1)  ${r.name}`;
  console.log(line);
}

if (failures.length) {
  console.error(
    `\n✗ ${failures.length} required brand pairing(s) fail WCAG AA:`,
  );
  for (const f of failures) {
    console.error(
      `    ${f.theme} · ${f.name} — ${f.ratio.toFixed(2)}:1 (needs ${f.threshold}:1)`,
    );
  }
  console.error(
    `\n  Adjust the tokens in src/styles.css (and mirror in src/lib/contrast.ts) until all pairings pass.`,
  );
  process.exit(1);
}

console.log(
  `\n✓ All ${required.length} required brand pairings meet WCAG AA.`,
);
process.exit(0);