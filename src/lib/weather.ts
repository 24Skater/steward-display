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

/**
 * The widget's place, or undefined when it is missing or not a real place.
 * Stored config is whatever was saved (imports, older builds), so it is
 * checked before anything relies on it, the same way the server checks it.
 */
export function placeOf(config: WeatherConfig): WeatherPlace | undefined {
  const place = config.place as Partial<WeatherPlace> | undefined;
  if (!place || typeof place !== "object") return undefined;
  const { name, latitude, longitude } = place;
  if (typeof name !== "string" || !name.trim()) return undefined;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
    return undefined;
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    return undefined;
  }
  return {
    name,
    latitude,
    longitude,
    region: typeof place.region === "string" ? place.region : undefined,
    country: typeof place.country === "string" ? place.country : undefined,
  };
}

export function isFresh(report: WeatherReport, now = Date.now()): boolean {
  return now - Date.parse(report.fetchedAt) < STALE_AFTER_MS;
}

/** The reading for a widget's place, or undefined while unknown or unavailable. */
export function useWeather(config: WeatherConfig): WeatherReport | undefined {
  const provided = useContext(WeatherReportsContext);
  const units = config.units === "celsius" ? "celsius" : "fahrenheit";
  const place = placeOf(config);
  const key = place ? weatherKey(place, units) : null;
  // The reading travels with the key it is for, so picking another place never
  // shows the old place's weather under the new name while the new one loads.
  const [fetched, setFetched] = useState<{ key: string; report?: WeatherReport } | null>(null);

  useEffect(() => {
    if (provided || !place || !key) return;
    let stopped = false;
    const load = () =>
      getWeatherFn({ data: { latitude: place.latitude, longitude: place.longitude, units } })
        .then((report) => !stopped && setFetched({ key, report: report ?? undefined }))
        .catch(() => !stopped && setFetched({ key }));
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // key captures the place and units; the place object itself changes identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provided, key]);

  if (!key) return undefined;
  if (provided) return provided[key];
  return fetched?.key === key ? fetched.report : undefined;
}
