export interface WeatherConfig {
  city?: string;
}

export function WeatherWidget({ config }: { config: WeatherConfig }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
      <p className="font-semibold" style={{ fontSize: "clamp(1rem, 3cqw, 1.75rem)" }}>
        {config.city ?? "Set a city"}
      </p>
      <p className="font-bold tabular-nums" style={{ fontSize: "clamp(2rem, 9cqw, 6rem)" }}>
        72°
      </p>
      <p className="opacity-70" style={{ fontSize: "clamp(0.75rem, 2cqw, 1.125rem)" }}>
        Add an API key to enable live weather
      </p>
    </div>
  );
}
