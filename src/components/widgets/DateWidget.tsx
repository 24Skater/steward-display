import { useEffect, useState } from "react";

import { useTimeZone } from "@/lib/timezone";

export interface DateConfig {
  format?: "full" | "long" | "medium" | "short";
}

export function DateWidget({ config }: { config: DateConfig }) {
  const timeZone = useTimeZone();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: config.format ?? "full",
    timeZone,
  }).format(now);
  return (
    <div
      className="flex h-full w-full items-center justify-center text-center font-semibold"
      style={{ fontSize: "clamp(1rem, 6cqw, 4rem)" }}
    >
      {formatted}
    </div>
  );
}
