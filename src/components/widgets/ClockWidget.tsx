import { useEffect, useState } from "react";

import { useTimeZone, wallClock } from "@/lib/timezone";

export interface ClockConfig {
  format24h?: boolean;
  showSeconds?: boolean;
}

export function ClockWidget({ config }: { config: ClockConfig }) {
  const timeZone = useTimeZone();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now)
    return (
      <div className="flex h-full w-full items-center justify-center font-bold tabular-nums">
        --:--
      </div>
    );

  const clock = wallClock(now, timeZone);
  const hours = config.format24h ? clock.hour : ((clock.hour + 11) % 12) + 1;
  const mm = String(clock.minute).padStart(2, "0");
  const ss = String(clock.second).padStart(2, "0");
  const ampm = !config.format24h ? (clock.hour >= 12 ? " PM" : " AM") : "";

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="flex items-baseline gap-1 font-bold leading-none tabular-nums"
        style={{ fontSize: "clamp(2rem, 18cqw, 12rem)" }}
      >
        <span>
          {hours}:{mm}
        </span>
        {config.showSeconds && (
          <span className="opacity-70" style={{ fontSize: "0.6em" }}>
            :{ss}
          </span>
        )}
        {ampm && (
          <span className="opacity-70" style={{ fontSize: "0.4em" }}>
            {ampm}
          </span>
        )}
      </div>
    </div>
  );
}
