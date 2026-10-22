import { createContext, useContext, useEffect, useState } from "react";

import { getWeatherFn } from "@/lib/api/weather.functions";

/**
 * Weather as the widgets see it.
 *
 * On a paired TV the readings arrive inside the screen payload, keyed by
 * place, and are provided here; the TV makes no requests of its own. In the
 * editor and preview there is no provider, so each weather widget asks the
 * server (which caches) for its place.
 */
export interface WeatherReport {
  temperature: number;
  code: number;
  isDay: boolean;
  units: "fahrenheit" | "celsius";
  daily: { date: string; high: number; low: number; code: number }[];
  fetchedAt: string;
}

export interface WeatherPlace {
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export interface WeatherConfig {
  place?: WeatherPlace;
  units?: "fahrenheit" | "celsius";
  showForecast?: boolean;
  /** Older builds asked for a city name; kept only so the editor can say what to do. */
  city?: string;
}

/** A reading older than this is not shown as current. Matches the server's STALE_AFTER_MS. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;

/** Same key as the server's weatherKey(). */
export function weatherKey(place: WeatherPlace, units: "fahrenheit" | "celsius"): string {
  return `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)},${units}`;
}

export const WeatherReportsContext = createContext<Record<string, WeatherReport> | null>(null);

export function isFresh(report: WeatherReport, now = Date.now()): boolean {
  return now - Date.parse(report.fetchedAt) < STALE_AFTER_MS;
}

/** The reading for a widget's place, or undefined while unknown or unavailable. */
export function useWeather(config: WeatherConfig): WeatherReport | undefined {
  const provided = useContext(WeatherReportsContext);
  const units = config.units === "celsius" ? "celsius" : "fahrenheit";
  const key = config.place ? weatherKey(config.place, units) : null;
  const [fetched, setFetched] = useState<WeatherReport | undefined>(undefined);

  useEffect(() => {
    if (provided || !config.place) return;
    let stopped = false;
    const place = config.place;
    const load = () =>
      getWeatherFn({ data: { latitude: place.latitude, longitude: place.longitude, units } })
        .then((report) => !stopped && setFetched(report ?? undefined))
        .catch(() => !stopped && setFetched(undefined));
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // key captures the place and units; the place object itself changes identity on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provided, key]);

  if (!key) return undefined;
  return provided ? provided[key] : fetched;
}
