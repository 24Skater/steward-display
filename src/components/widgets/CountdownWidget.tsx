import { useEffect, useState } from "react";

export interface CountdownConfig {
  target?: string; // ISO datetime
  label?: string;
  units?: Array<"days" | "hours" | "minutes" | "seconds">;
}

function diff(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function CountdownWidget({ config }: { config: CountdownConfig }) {
  const target = config.target ? new Date(config.target) : null;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  if (!target || Number.isNaN(target.getTime())) {
    return (
      <div className="flex h-full w-full items-center justify-center opacity-60">
        Set a target date
      </div>
    );
  }
  const d = diff(target);
  const units = config.units ?? ["days", "hours", "minutes"];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
      {config.label && (
        <p className="opacity-80" style={{ fontSize: "clamp(0.875rem, 2.5cqw, 1.5rem)" }}>
          {config.label}
        </p>
      )}
      <div className="flex items-end gap-4">
        {units.map((u) => (
          <div key={u} className="flex flex-col items-center">
            <span
              className="font-bold tabular-nums leading-none"
              style={{ fontSize: "clamp(2rem, 10cqw, 7rem)" }}
            >
              {String(d[u]).padStart(2, "0")}
            </span>
            <span
              className="mt-1 text-xs uppercase tracking-wider opacity-70"
              style={{ fontSize: "clamp(0.6rem, 1.5cqw, 1rem)" }}
            >
              {u}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
