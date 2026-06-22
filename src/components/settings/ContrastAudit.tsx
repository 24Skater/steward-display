import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  AlertTriangle,
  FileJson,
  Terminal,
  Settings2,
  ExternalLink,
  Hash,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  auditBrandContrast,
  DEFAULT_CONTRAST_CONFIG,
  type PairResult,
  type ContrastConfig,
} from "@/lib/contrast";
import { getContrastConfig } from "@/lib/contrastConfig.functions";
import {
  getTokenLocations,
  type TokenLocation,
} from "@/lib/tokenLocations.functions";

type ResolvedConfig = ContrastConfig & {
  source: { jsonPath: string | null; envOverrides: string[] };
};

const REPO_SOURCE_URL = (import.meta.env.VITE_REPO_SOURCE_URL ?? "") as string;

function buildSourceHref(
  sourcePath: string | undefined,
  line: number | undefined,
): string | null {
  if (!REPO_SOURCE_URL || !sourcePath || !line) return null;
  return `${REPO_SOURCE_URL.replace(/\/$/, "")}/${sourcePath}#L${line}`;
}

function TokenChip({
  varName,
  hex,
  locations,
  sourcePath,
  onJump,
}: {
  varName: string;
  hex: string;
  locations: TokenLocation[] | undefined;
  sourcePath: string | undefined;
  onJump: (varName: string) => void;
}) {
  const firstLine = locations?.[0]?.line;
  const href = buildSourceHref(sourcePath, firstLine);
  const sharedClass =
    "group inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary hover:bg-primary/10";
  const inner = (
    <>
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm border border-border/70"
        style={{ background: hex }}
        aria-hidden="true"
      />
      <span>{varName}</span>
      {firstLine && (
        <span className="text-muted-foreground">:{firstLine}</span>
      )}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={sharedClass}
        title={`Open ${varName} in ${sourcePath} (line ${firstLine}) on GitHub`}
      >
        {inner}
        <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onJump(varName)}
      className={sharedClass}
      title={
        firstLine
          ? `Jump to ${varName} in the token reference below (line ${firstLine} in ${sourcePath})`
          : `Jump to ${varName} in the token reference below`
      }
    >
      {inner}
    </button>
  );
}

function Row({
  r,
  level,
  tokens,
  sourcePath,
  onJump,
}: {
  r: PairResult;
  level: "AA" | "AAA";
  tokens: Record<string, TokenLocation[]>;
  sourcePath: string | undefined;
  onJump: (varName: string) => void;
}) {
  const ok = r.passAA;
  const isInfo = !r.required;
  const isFail = !isInfo && !ok;
  return (
    <li
      className={
        "flex flex-wrap items-center gap-3 rounded-md border p-2 transition-colors " +
        (isFail
          ? "border-red/60 bg-red/10 ring-1 ring-red/40 shadow-sm"
          : "border-border")
      }
      data-pass={ok}
      data-fail={isFail || undefined}
      aria-invalid={isFail || undefined}
    >
      <span
        className={
          "inline-flex h-9 w-16 shrink-0 items-center justify-center rounded text-xs font-semibold " +
          (isFail ? "ring-2 ring-red/60" : "")
        }
        style={{ background: r.bg, color: r.fg, border: "1px solid rgba(0,0,0,.08)" }}
        aria-hidden="true"
      >
        Aa
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={
            "truncate text-sm font-medium " +
            (isFail ? "text-red" : "text-foreground")
          }
        >
          {isFail && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
          {r.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <TokenChip
            varName={r.fgVar}
            hex={r.fg}
            locations={tokens[r.fgVar]}
            sourcePath={sourcePath}
            onJump={onJump}
          />
          <span className="opacity-60">on</span>
          <TokenChip
            varName={r.bgVar}
            hex={r.bg}
            locations={tokens[r.bgVar]}
            sourcePath={sourcePath}
            onJump={onJump}
          />
          <span className="opacity-60">·</span>
          <span>
            {r.use === "body"
              ? "Body text"
              : r.use === "large"
                ? "Large text"
                : r.use === "ui"
                  ? "UI / non-text"
                  : "Decorative"}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={
            "tabular-nums text-sm font-semibold " +
            (isFail ? "text-red" : "text-foreground")
          }
          title={`Threshold ≥ ${r.threshold}:1`}
        >
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
              (ok ? "bg-emerald/15 text-emerald" : "bg-red/20 text-red")
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

  const fetchTokens = useServerFn(getTokenLocations);
  const { data: tokenData } = useQuery({
    queryKey: ["token-locations"],
    queryFn: () => fetchTokens(),
    staleTime: 5 * 60_000,
  });
  const tokens = tokenData?.tokens ?? {};
  const sourcePath = tokenData?.sourcePath;

  const active: ResolvedConfig =
    config ?? { ...DEFAULT_CONTRAST_CONFIG, source: { jsonPath: null, envOverrides: [] } };

  const [showOnlyFailing, setShowOnlyFailing] = useState(false);
  const [themeFilter, setThemeFilter] = useState<"all" | "light" | "dark">("all");

  const results = useMemo(() => auditBrandContrast(active), [active]);
  const light = results.filter((r) => r.theme === "light");
  const dark = results.filter((r) => r.theme === "dark");
  const filteredLight = useMemo(
    () => light.filter((r) => !showOnlyFailing || (r.required && !r.passAA)),
    [light, showOnlyFailing],
  );
  const filteredDark = useMemo(
    () => dark.filter((r) => !showOnlyFailing || (r.required && !r.passAA)),
    [dark, showOnlyFailing],
  );
  const required = results.filter((r) => r.required);
  const failing = required.filter((r) => !r.passAA).length;
  const level: "AA" | "AAA" = active.requireAAA ? "AAA" : "AA";
  const failingVars = useMemo(() => {
    const s = new Set<string>();
    for (const r of required) {
      if (!r.passAA) {
        s.add(r.fgVar);
        s.add(r.bgVar);
      }
    }
    return s;
  }, [required]);

  const visiblePairs = useMemo(() => {
    const list: PairResult[] = [];
    if (themeFilter !== "dark") list.push(...filteredLight);
    if (themeFilter !== "light") list.push(...filteredDark);
    return list;
  }, [themeFilter, filteredLight, filteredDark]);

  const visibleVars = useMemo(() => {
    const s = new Set<string>();
    for (const r of visiblePairs) {
      s.add(r.fgVar);
      s.add(r.bgVar);
    }
    return s;
  }, [visiblePairs]);

  const [highlightVar, setHighlightVar] = useState<string | null>(null);
  const jumpToVar = useCallback((v: string) => {
    setHighlightVar(v);
    const el = document.getElementById(`token-${v}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightVar(null), 2200);
  }, []);

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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted p-1"
          role="group"
          aria-label="Theme focus"
        >
          {(["all", "light", "dark"] as const).map((t) => {
            const active = themeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setThemeFilter(t)}
                aria-pressed={active}
                className={
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                  (active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t === "all" ? "All themes" : t === "light" ? "Light" : "Dark"}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowOnlyFailing((v) => !v)}
          className={
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors " +
            (showOnlyFailing
              ? "border-red/60 bg-red/10 text-red hover:bg-red/15"
              : "border-border bg-background text-foreground hover:bg-muted")
          }
          aria-pressed={showOnlyFailing}
        >
          {showOnlyFailing ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              Show all pairs
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Show only failing
            </>
          )}
        </button>
      </div>

      {themeFilter !== "dark" && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Light theme
          </h3>
          <ul className="space-y-1.5">
            {filteredLight.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                {showOnlyFailing ? "No failing pairs in the light theme." : "No pairs in the light theme."}
              </li>
            ) : (
              filteredLight.map((r) => (
                <Row key={`l-${r.name}`} r={r} level={level} tokens={tokens} sourcePath={sourcePath} onJump={jumpToVar} />
              ))
            )}
          </ul>
        </div>
      )}

      {themeFilter !== "light" && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dark theme
          </h3>
          <ul className="space-y-1.5">
            {filteredDark.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                {showOnlyFailing ? "No failing pairs in the dark theme." : "No pairs in the dark theme."}
              </li>
            ) : (
              filteredDark.map((r) => (
                <Row key={`d-${r.name}`} r={r} level={level} tokens={tokens} sourcePath={sourcePath} onJump={jumpToVar} />
              ))
            )}
          </ul>
        </div>
      )}

      <TokenReference
        tokens={tokens}
        visibleVars={visibleVars}
        sourcePath={sourcePath}
        failingVars={failingVars}
        highlightVar={highlightVar}
      />
    </div>
  );
}

function TokenReference({
  tokens,
  visibleVars,
  sourcePath,
  failingVars,
  highlightVar,
}: {
  tokens: Record<string, TokenLocation[]>;
  visibleVars: Set<string>;
  sourcePath: string | undefined;
  failingVars: Set<string>;
  highlightVar: string | null;
}) {
  const names = Object.keys(tokens)
    .filter((n) => visibleVars.has(n))
    .sort();
  if (!names.length) return null;
  return (
    <section
      aria-labelledby="token-ref-heading"
      className="rounded-lg border border-border bg-muted/30 p-4"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3
            id="token-ref-heading"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Token reference
          </h3>
          <p className="text-xs text-muted-foreground">
            CSS custom properties defined in{" "}
            <code className="rounded bg-background px-1 py-0.5 text-[11px]">
              {sourcePath ?? "src/styles.css"}
            </code>
            . Click any chip above to jump here.
          </p>
        </div>
        {!REPO_SOURCE_URL && (
          <span
            className="text-[11px] text-muted-foreground"
            title="Set VITE_REPO_SOURCE_URL (e.g. https://github.com/org/repo/blob/main) to turn chips into deep-links."
          >
            Tip: set <code>VITE_REPO_SOURCE_URL</code> for GitHub deep-links
          </span>
        )}
      </header>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {names.map((name) => {
          const locs = tokens[name];
          const isFailing = failingVars.has(name);
          const isHighlight = highlightVar === name;
          return (
            <li
              key={name}
              id={`token-${name}`}
              className={
                "flex items-start gap-2 rounded-md border p-2 text-xs transition-colors " +
                (isHighlight
                  ? "border-primary bg-primary/15"
                  : isFailing
                    ? "border-red/50 bg-red/5"
                    : "border-border bg-background")
              }
            >
              <Hash className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate font-mono text-[12px] font-semibold text-foreground">
                    {name}
                  </code>
                  {isFailing && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Failing pair
                    </span>
                  )}
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {locs.map((l) => {
                    const href = buildSourceHref(sourcePath, l.line);
                    const inner = (
                      <>
                        <span className="font-medium uppercase tracking-wide">{l.scope}</span>
                        <span className="opacity-50">·</span>
                        <code className="font-mono">{l.value}</code>
                        <span className="opacity-50">·</span>
                        <span>line {l.line}</span>
                      </>
                    );
                    return (
                      <li key={`${l.scope}-${l.line}`}>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                          >
                            {inner}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">{inner}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
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