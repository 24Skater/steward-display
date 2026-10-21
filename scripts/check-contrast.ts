#!/usr/bin/env bun
/**
 * CI gate: fail the build if any non-decorative brand token pairing
 * drops below its WCAG AA threshold.
 *
 * Run via `bun run check:contrast` or as a prebuild hook.
 * Also writes machine + human reports to ./reports/ for CI artifacts:
 *   - reports/contrast.json
 *   - reports/contrast.html
 *   - reports/contrast.md  (GitHub step summary friendly)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditBrandContrast, type PairResult } from "../src/lib/contrast";
import { loadContrastConfig } from "../src/lib/contrast.config";

const config = loadContrastConfig();
const results = auditBrandContrast(config);
const required = results.filter((r) => r.required);
const failures = required.filter((r) => !r.passAA);

const pad = (s: string, n: number) => s.padEnd(n);

console.log(`Steward brand contrast audit`);
console.log(
  `  Mode: ${config.requireAAA ? "AAA" : "AA"}${
    config.failOnDecorative ? " · decorative pairings enforced" : ""
  }`,
);
console.log(
  `  Thresholds: body ≥ ${config.thresholds.body}:1, large ≥ ${config.thresholds.large}:1, ui ≥ ${config.thresholds.ui}:1, decorative ≥ ${config.thresholds.decorative}:1`,
);
if (config.source.jsonPath) console.log(`  Config file: ${config.source.jsonPath}`);
if (config.source.envOverrides.length)
  console.log(`  Env overrides: ${config.source.envOverrides.join(", ")}`);
console.log(
  `  ${required.length} required pairing(s), ${results.length - required.length} informational\n`,
);

for (const r of results) {
  const tag = r.use === "decorative" ? "INFO" : r.passAA ? (r.passAAA ? "AAA " : "AA  ") : "FAIL";
  const line = `  [${tag}] ${pad(r.theme, 5)} ${r.ratio
    .toFixed(2)
    .padStart(5)}:1  (≥${r.threshold}:1)  ${r.name}`;
  console.log(line);
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} required brand pairing(s) fail WCAG AA:`);
  for (const f of failures) {
    console.error(`    ${f.theme} · ${f.name} — ${f.ratio.toFixed(2)}:1 (needs ${f.threshold}:1)`);
  }
  console.error(
    `\n  Adjust the tokens in src/styles.css (and mirror in src/lib/contrast.ts) until all pairings pass.`,
  );
}

if (!failures.length) {
  console.log(`\n✓ All ${required.length} required brand pairings meet WCAG AA.`);
}

// ── Write reports ─────────────────────────────────────────────────────────
const outDir = resolve(process.cwd(), "reports");
mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const summary = {
  generatedAt,
  config: {
    requireAAA: config.requireAAA,
    failOnDecorative: config.failOnDecorative,
    thresholds: config.thresholds,
    source: config.source,
  },
  totals: {
    pairings: results.length,
    required: required.length,
    informational: results.length - required.length,
    passingAA: required.filter((r) => r.passAA).length,
    passingAAA: required.filter((r) => r.passAAA).length,
    failing: failures.length,
  },
  status: failures.length === 0 ? "pass" : "fail",
  results,
};
writeFileSync(resolve(outDir, "contrast.json"), JSON.stringify(summary, null, 2));
writeFileSync(resolve(outDir, "contrast.html"), renderHtml(summary));
writeFileSync(resolve(outDir, "contrast.md"), renderMarkdown(summary));

console.log(`\nReports written to ${outDir}/`);
process.exit(failures.length ? 1 : 0);

// ── Renderers ─────────────────────────────────────────────────────────────
function badge(r: PairResult): string {
  if (r.use === "decorative") return "Info";
  if (!r.passAA) return "FAIL";
  return r.passAAA ? "AAA" : "AA";
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

function renderHtml(s: typeof summary): string {
  const rowsFor = (theme: "light" | "dark") =>
    s.results
      .filter((r) => r.theme === theme)
      .map((r) => {
        const tag = badge(r);
        const tagClass =
          r.use === "decorative" ? "info" : r.passAA ? (r.passAAA ? "aaa" : "aa") : "fail";
        return `<tr class="row ${tagClass}">
    <td><span class="swatch" style="background:${r.bg};color:${r.fg}">Aa</span></td>
    <td class="name">${esc(r.name)}</td>
    <td class="mono">${esc(r.fg.toUpperCase())} <span class="dim">on</span> ${esc(r.bg.toUpperCase())}</td>
    <td class="use">${r.use}</td>
    <td class="ratio">${r.ratio.toFixed(2)}:1</td>
    <td class="thr">≥ ${r.threshold}:1</td>
    <td><span class="badge ${tagClass}">${tag}</span></td>
  </tr>`;
      })
      .join("\n");

  const statusBanner =
    s.status === "pass"
      ? `<div class="banner pass">✓ All ${s.totals.required} required brand pairings meet WCAG ${s.config.requireAAA ? "AAA" : "AA"}</div>`
      : `<div class="banner fail">✗ ${s.totals.failing} of ${s.totals.required} required pairings fail WCAG ${s.config.requireAAA ? "AAA" : "AA"}</div>`;

  const cfgChips = [
    `Mode: <strong>${s.config.requireAAA ? "AAA" : "AA"}</strong>`,
    `body ≥ ${s.config.thresholds.body}:1`,
    `large ≥ ${s.config.thresholds.large}:1`,
    `ui ≥ ${s.config.thresholds.ui}:1`,
    `decorative ${s.config.failOnDecorative ? "enforced" : "informational"} (≥ ${s.config.thresholds.decorative}:1)`,
    s.config.source.jsonPath ? `config: <code>${esc(s.config.source.jsonPath)}</code>` : null,
    s.config.source.envOverrides.length
      ? `env: <code>${esc(s.config.source.envOverrides.join(", "))}</code>`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Steward · Brand contrast report</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light dark; --bg:#faf7f2; --fg:#0d1b2e; --muted:#57647a; --border:#b8a778; --card:#fff; --pass:#15803d; --fail:#dc2626; --info:#6b7a8d; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#060f1a; --fg:#f5eed8; --muted:#a89878; --border:#3d5878; --card:#0d1b2e; }
  }
  body { margin:0; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif; background:var(--bg); color:var(--fg); }
  .wrap { max-width:1080px; margin:0 auto; padding:32px 24px 64px; }
  h1 { margin:0 0 4px; font-size:24px; }
  .meta { color:var(--muted); margin-bottom:24px; font-size:13px; }
  .banner { padding:12px 16px; border-radius:10px; font-weight:600; margin-bottom:20px; }
  .banner.pass { background:color-mix(in oklab, var(--pass) 14%, transparent); color:var(--pass); }
  .banner.fail { background:color-mix(in oklab, var(--fail) 14%, transparent); color:var(--fail); }
  .stats { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
  .stat { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:10px 14px; min-width:120px; }
  .stat .n { font-size:20px; font-weight:700; }
  .stat .l { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:28px 0 10px; }
  table { width:100%; border-collapse:separate; border-spacing:0; background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  th, td { padding:10px 12px; text-align:left; border-bottom:1px solid var(--border); font-size:13px; vertical-align:middle; }
  tr:last-child td { border-bottom:0; }
  th { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); background:color-mix(in oklab, var(--border) 18%, transparent); font-weight:600; }
  .swatch { display:inline-flex; align-items:center; justify-content:center; width:54px; height:32px; border-radius:6px; font-weight:700; font-size:12px; border:1px solid rgba(0,0,0,.08); }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; color:var(--muted); }
  .dim { opacity:.6; }
  .ratio { font-variant-numeric: tabular-nums; font-weight:600; }
  .thr { color:var(--muted); font-variant-numeric: tabular-nums; }
  .use { color:var(--muted); text-transform:capitalize; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.04em; }
  .badge.aa, .badge.aaa { background:color-mix(in oklab, var(--pass) 16%, transparent); color:var(--pass); }
  .badge.fail { background:color-mix(in oklab, var(--fail) 16%, transparent); color:var(--fail); }
  .badge.info { background:color-mix(in oklab, var(--info) 18%, transparent); color:var(--info); }
</style>
</head>
<body>
<div class="wrap">
  <h1>Steward · Brand contrast report</h1>
  <div class="meta">Generated ${esc(s.generatedAt)} · WCAG 2.1</div>
  <div class="meta">${cfgChips}</div>
  ${statusBanner}
  <div class="stats">
    <div class="stat"><div class="n">${s.totals.required}</div><div class="l">Required</div></div>
    <div class="stat"><div class="n">${s.totals.passingAA}</div><div class="l">Pass AA</div></div>
    <div class="stat"><div class="n">${s.totals.passingAAA}</div><div class="l">Pass AAA</div></div>
    <div class="stat"><div class="n">${s.totals.failing}</div><div class="l">Failing</div></div>
    <div class="stat"><div class="n">${s.totals.decorative}</div><div class="l">Decorative</div></div>
  </div>

  <h2>Light theme</h2>
  <table>
    <thead><tr><th></th><th>Pairing</th><th>Tokens</th><th>Use</th><th>Ratio</th><th>Threshold</th><th>Status</th></tr></thead>
    <tbody>${rowsFor("light")}</tbody>
  </table>

  <h2>Dark theme</h2>
  <table>
    <thead><tr><th></th><th>Pairing</th><th>Tokens</th><th>Use</th><th>Ratio</th><th>Threshold</th><th>Status</th></tr></thead>
    <tbody>${rowsFor("dark")}</tbody>
  </table>
</div>
</body>
</html>
`;
}

function renderMarkdown(s: typeof summary): string {
  const level = s.config.requireAAA ? "AAA" : "AA";
  const head =
    s.status === "pass"
      ? `### ✓ Steward contrast — all ${s.totals.required} required pairings meet WCAG ${level}`
      : `### ✗ Steward contrast — ${s.totals.failing} of ${s.totals.required} required pairings fail WCAG ${level}`;
  const cfgLine = `**Mode:** ${level} · body ≥ ${s.config.thresholds.body}:1 · large ≥ ${s.config.thresholds.large}:1 · ui ≥ ${s.config.thresholds.ui}:1 · decorative ${s.config.failOnDecorative ? "enforced" : "informational"} (≥ ${s.config.thresholds.decorative}:1)`;
  const sect = (theme: "light" | "dark") => {
    const rows = s.results
      .filter((r) => r.theme === theme)
      .map(
        (r) =>
          `| ${badge(r)} | ${r.name} | \`${r.fg.toUpperCase()}\` on \`${r.bg.toUpperCase()}\` | ${r.use} | ${r.ratio.toFixed(2)}:1 | ≥ ${r.threshold}:1 |`,
      )
      .join("\n");
    return `\n#### ${theme[0].toUpperCase()}${theme.slice(1)} theme\n\n| Status | Pairing | Tokens | Use | Ratio | Threshold |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`;
  };
  return `${head}\n\n${cfgLine}\n\n_Generated ${s.generatedAt}_\n${sect("light")}${sect("dark")}`;
}
