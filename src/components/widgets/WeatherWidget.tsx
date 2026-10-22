import { describeWeather } from "@/lib/weather-codes";
import { isFresh, useWeather, type WeatherConfig } from "@/lib/weather";
import { SetupHint } from "./SetupHint";

export type { WeatherConfig };

const DAY = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });

/**
 * Current conditions, and optionally the next days, from Open-Meteo through
 * the server. Never shows a made-up or stale temperature: without a fresh
 * reading it renders nothing on the TV and a hint in the editor.
 */
export function WeatherWidget({ config }: { config: WeatherConfig }) {
  const report = useWeather(config);

  if (!config.place) {
    return (
      <SetupHint>
        {config.city
          ? `Pick the place for "${config.city}" in this widget's settings.`
          : "Pick a place in this widget's settings."}
      </SetupHint>
    );
  }
  if (!report || !isFresh(report)) {
    return <SetupHint>Weather for {config.place.name} is loading or unavailable.</SetupHint>;
  }

  const { label, Icon } = describeWeather(report.code, report.isDay);
  const degree = report.units === "celsius" ? "°C" : "°F";
  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 p-4">
      <div className="flex items-center gap-4">
        <Icon className="shrink-0" style={{ width: "clamp(2rem, 16cqw, 7rem)", height: "auto" }} />
        <div className="min-w-0">
          <p
            className="font-bold leading-none tabular-nums"
            style={{ fontSize: "clamp(2rem, 18cqw, 9rem)" }}
          >
            {report.temperature}
            <span className="align-top opacity-70" style={{ fontSize: "0.4em" }}>
              {degree}
            </span>
          </p>
          <p className="truncate opacity-80" style={{ fontSize: "clamp(0.875rem, 4cqw, 2rem)" }}>
            {label} · {config.place.name}
          </p>
        </div>
      </div>
      {config.showForecast !== false && report.daily.length > 0 && (
        <ul
          className="flex justify-between gap-2 tabular-nums"
          style={{ fontSize: "clamp(0.75rem, 3.2cqw, 1.5rem)" }}
          aria-label="Forecast"
        >
          {report.daily.map((day) => {
            const { Icon: DayIcon, label: dayLabel } = describeWeather(day.code);
            return (
              <li key={day.date} className="flex flex-col items-center gap-1">
                <span className="opacity-70">{DAY.format(new Date(`${day.date}T12:00:00Z`))}</span>
                <DayIcon aria-label={dayLabel} style={{ width: "1.6em", height: "1.6em" }} />
                <span>
                  {day.high}° <span className="opacity-60">{day.low}°</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-right opacity-40" style={{ fontSize: "clamp(0.5rem, 1.6cqw, 0.75rem)" }}>
        Weather: Open-Meteo.com
      </p>
    </div>
  );
}
