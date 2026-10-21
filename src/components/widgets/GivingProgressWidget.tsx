import { SetupHint } from "./SetupHint";

export interface GivingConfig {
  label?: string;
  goal?: number;
  current?: number;
  accent?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function GivingProgressWidget({ config }: { config: GivingConfig }) {
  const goal = config.goal ?? 0;
  const current = config.current ?? 0;
  // Never invent a goal: these figures are shown to the congregation as fact.
  if (!(goal > 0)) return <SetupHint>Set a giving goal</SetupHint>;
  const pct = Math.min(100, Math.round((current / goal) * 100));
  const accent = config.accent ?? "var(--emerald)";
  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 p-6">
      {config.label && (
        <p className="font-semibold" style={{ fontSize: "clamp(1rem, 3cqw, 1.75rem)" }}>
          {config.label}
        </p>
      )}
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-bold tabular-nums" style={{ fontSize: "clamp(1.25rem, 5cqw, 3rem)" }}>
          {fmt(current)}
        </span>
        <span
          className="opacity-70 tabular-nums"
          style={{ fontSize: "clamp(0.875rem, 2.5cqw, 1.5rem)" }}
        >
          of {fmt(goal)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-black/15">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: accent }}
        />
      </div>
      <p
        className="text-right opacity-70 tabular-nums"
        style={{ fontSize: "clamp(0.75rem, 2cqw, 1.125rem)" }}
      >
        {pct}%
      </p>
    </div>
  );
}
