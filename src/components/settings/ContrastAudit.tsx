import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, AlertTriangle, FileJson, Terminal, Settings2 } from "lucide-react";
import {
  auditBrandContrast,
  DEFAULT_CONTRAST_CONFIG,
  type PairResult,
  type ContrastConfig,
} from "@/lib/contrast";
import { getContrastConfig } from "@/lib/contrastConfig.functions";

type ResolvedConfig = ContrastConfig & {
  source: { jsonPath: string | null; envOverrides: string[] };
};

function Row({ r, level }: { r: PairResult; level: "AA" | "AAA" }) {
  const ok = r.passAA;
  const isInfo = !r.required;
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
        <span className="tabular-nums text-sm font-semibold text-foreground" title={`Threshold ≥ ${r.threshold}:1`}>
          {r.ratio.toFixed(2)}:1
        </span>
        {isInfo ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
            title="Decorative — not enforced by the active config"
          >
            Info
          </span>
        ) : (
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
              (ok ? "bg-emerald/15 text-emerald" : "bg-red/15 text-red")
            }
            title={`Needs ≥ ${r.threshold}:1 for WCAG ${level}`}
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
  const fetchConfig = useServerFn(getContrastConfig);
  const { data: config, isLoading, error } = useQuery<ResolvedConfig>({
    queryKey: ["contrast-config"],
    queryFn: () => fetchConfig(),
    staleTime: 60_000,
  });

  const active: ResolvedConfig =
    config ?? { ...DEFAULT_CONTRAST_CONFIG, source: { jsonPath: null, envOverrides: [] } };

  const results = useMemo(() => auditBrandContrast(active), [active]);
  const light = results.filter((r) => r.theme === "light");
  const dark = results.filter((r) => r.theme === "dark");
  const required = results.filter((r) => r.required);
  const failing = required.filter((r) => !r.passAA).length;
  const level: "AA" | "AAA" = active.requireAAA ? "AAA" : "AA";

  return (
    <div className="space-y-5">
      <ActiveConfigCard
        config={active}
        loading={isLoading}
        error={error ? String((error as Error).message ?? error) : null}
      />

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
            All {required.length} required brand pairings meet WCAG {level}.
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4" />
            {failing} of {required.length} required pairing{required.length === 1 ? "" : "s"} fail WCAG {level}.
          </>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Light theme
        </h3>
        <ul className="space-y-1.5">
          {light.map((r) => (
            <Row key={`l-${r.name}`} r={r} level={level} />
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dark theme
        </h3>
        <ul className="space-y-1.5">
          {dark.map((r) => (
            <Row key={`d-${r.name}`} r={r} level={level} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function ActiveConfigCard({
  config,
  loading,
  error,
}: {
  config: ResolvedConfig;
  loading: boolean;
  error: string | null;
}) {
  const sourceLabel = (use: keyof ContrastConfig["thresholds"]) => {
    const envName = `CONTRAST_${use.toUpperCase()}`;
    if (config.source.envOverrides.includes(envName)) return { label: "env", icon: Terminal };
    if (config.source.jsonPath) return { label: "json", icon: FileJson };
    return { label: "default", icon: Settings2 };
  };
  const aaaSrc = config.source.envOverrides.includes("CONTRAST_REQUIRE_AAA")
    ? "env"
    : config.source.jsonPath
      ? "json"
      : "default";
  const decSrc = config.source.envOverrides.includes("CONTRAST_FAIL_ON_DECORATIVE")
    ? "env"
    : config.source.jsonPath
      ? "json"
      : "default";

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-foreground">Active rules</div>
          <div className="text-xs text-muted-foreground">
            Resolved on the server. Precedence: env vars → JSON file → WCAG AA defaults.
          </div>
        </div>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold " +
            (config.requireAAA ? "bg-primary/20 text-primary-foreground" : "bg-emerald/15 text-emerald")
          }
        >
          {loading ? "Loading…" : config.requireAAA ? "AAA mode" : "AA mode"}
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red/10 px-3 py-2 text-xs text-red" role="alert">
          Couldn't load server config — showing AA defaults. {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["body", "large", "ui", "decorative"] as const).map((use) => {
          const src = sourceLabel(use);
          const Icon = src.icon;
          return (
            <div key={use} className="rounded-md border border-border bg-background px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {use}
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-1">
                <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                  ≥ {config.thresholds[use]}:1
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                  title={`Source: ${src.label}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {src.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5">
          <dt className="text-muted-foreground">requireAAA</dt>
          <dd className="flex items-center gap-2 font-mono font-semibold text-foreground">
            {String(config.requireAAA)}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
              {aaaSrc}
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5">
          <dt className="text-muted-foreground">failOnDecorative</dt>
          <dd className="flex items-center gap-2 font-mono font-semibold text-foreground">
            {String(config.failOnDecorative)}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
              {decSrc}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <FileJson className="h-3 w-3" />
          <span>Config file:</span>
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {config.source.jsonPath ?? "(none)"}
          </code>
        </div>
        <div className="flex items-start gap-1.5">
          <Terminal className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Env overrides:</span>
          <span className="flex flex-wrap gap-1">
            {config.source.envOverrides.length === 0 ? (
              <span className="text-muted-foreground">(none)</span>
            ) : (
              config.source.envOverrides.map((v) => (
                <code
                  key={v}
                  className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                >
                  {v}
                </code>
              ))
            )}
          </span>
        </div>
      </div>
    </div>
  );
}