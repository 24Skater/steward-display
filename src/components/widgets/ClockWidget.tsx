import { useEffect, useState } from "react";

export interface ClockConfig {
  format24h?: boolean;
  showSeconds?: boolean;
}

export function ClockWidget({ config }: { config: ClockConfig }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <div className="flex h-full w-full items-center justify-center font-bold tabular-nums">--:--</div>;

  const hours = config.format24h ? now.getHours() : ((now.getHours() + 11) % 12) + 1;
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ampm = !config.format24h ? (now.getHours() >= 12 ? " PM" : " AM") : "";

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex items-baseline gap-1 font-bold leading-none tabular-nums" style={{ fontSize: "clamp(2rem, 18cqw, 12rem)" }}>
        <span>{hours}:{mm}</span>
        {config.showSeconds && <span className="opacity-70" style={{ fontSize: "0.6em" }}>:{ss}</span>}
        {ampm && <span className="opacity-70" style={{ fontSize: "0.4em" }}>{ampm}</span>}
      </div>
    </div>
  );
}