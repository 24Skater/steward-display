import { useMemo } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { auditBrandContrast, type PairResult } from "@/lib/contrast";

function Row({ r }: { r: PairResult }) {
  const ok = r.passAA;
  return (
    <li
      className="flex items-center gap-3 rounded-md border border-border p-2"
      data-pass={ok}
    >
      <span
        className="inline-flex h-9 w-16 shrink-0 items-center justify-center rounded text-xs font-semibold"
        style={{ background: r.bg, color: r.fg, border: "1px solid rgba(0,0,0,.08)" }}
        aria-hidden="true"
      >
        Aa
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
        <div className="text-xs text-muted-foreground">
          {r.fg.toUpperCase()} on {r.bg.toUpperCase()} · {
            r.use === "body" ? "Body text"
            : r.use === "large" ? "Large text"
            : r.use === "ui" ? "UI / non-text"
            : "Decorative"
          }
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="tabular-nums text-sm font-semibold text-foreground">
          {r.ratio.toFixed(2)}:1
        </span>
        {r.use === "decorative" ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
            title="Decorative — not required to meet WCAG"
          >
            Info
          </span>
        ) : (
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
              (ok ? "bg-emerald/15 text-emerald" : "bg-red/15 text-red")
            }
            title={`Needs ≥ ${r.threshold}:1 for WCAG AA`}
          >
            {ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {ok ? (r.passAAA ? "AAA" : "AA") : "Fail"}
          </span>
        )}
      </div>
    </li>
  );
}

export function ContrastAudit() {
  const results = useMemo(() => auditBrandContrast(), []);
  const light = results.filter((r) => r.theme === "light");
  const dark = results.filter((r) => r.theme === "dark");
  const required = results.filter((r) => r.use !== "decorative");
  const failing = required.filter((r) => !r.passAA).length;

  return (
    <div className="space-y-5">
      <div
        className={
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium " +
          (failing === 0
            ? "bg-emerald/10 text-emerald"
            : "bg-red/10 text-red")
        }
        role="status"
        aria-live="polite"
      >
        {failing === 0 ? (
          <>
            <Check className="h-4 w-4" />
            All {required.length} required brand pairings meet WCAG AA.
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4" />
            {failing} of {required.length} required pairing{required.length === 1 ? "" : "s"} fail WCAG AA.
          </>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Light theme
        </h3>
        <ul className="space-y-1.5">
          {light.map((r) => (
            <Row key={`l-${r.name}`} r={r} />
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dark theme
        </h3>
        <ul className="space-y-1.5">
          {dark.map((r) => (
            <Row key={`d-${r.name}`} r={r} />
          ))}
        </ul>
      </div>
    </div>
  );
}