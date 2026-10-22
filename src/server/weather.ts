import { z } from "zod";

import type { EnvBag } from "./env";
import { UserError } from "./errors";

/**
 * Weather from Open-Meteo, fetched by the server only.
 *
 * Browsers and TVs never call Open-Meteo themselves: the server caches one
 * reading per place for ten minutes however many screens show it, and a TV
 * keeps working off whatever its screen payload last carried.
 *
 * Open-Meteo's free API is for non-commercial use, which covers a church
 * running Display itself. The hosted platform sets OPEN_METEO_API_KEY, which
 * switches to Open-Meteo's commercial endpoints.
 *
 * Only two fixed hosts are ever called, with numbers the server validated, so
 * nothing a person types can steer the request anywhere else.
 */

export const REFRESH_MS = 10 * 60 * 1000;
/** A reading older than this is not shown as current, on a TV or anywhere. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const TIMEOUT_MS = 5_000;
const MAX_CACHED = 2_000;

export type Units = "fahrenheit" | "celsius";

/** How the server reaches Open-Meteo; replaced in tests. */
export type Fetcher = (url: URL) => Promise<Response>;

export interface Place {
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export interface WeatherReport {
  temperature: number;
  code: number;
  isDay: boolean;
  units: Units;
  /** The next three days, today first. */
  daily: { date: string; high: number; low: number; code: number }[];
  /** When the server fetched it, ISO 8601. */
  fetchedAt: string;
}

function endpoints(env: EnvBag) {
  const key = env.OPEN_METEO_API_KEY?.trim();
  return key
    ? {
        forecast: "https://customer-api.open-meteo.com/v1/forecast",
        geocoding: "https://customer-geocoding-api.open-meteo.com/v1/search",
        key,
      }
    : {
        forecast: "https://api.open-meteo.com/v1/forecast",
        geocoding: "https://geocoding-api.open-meteo.com/v1/search",
        key: null,
      };
}

export const coordinatesSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const geocodingResponse = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        admin1: z.string().optional(),
        country: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .optional(),
});

const forecastResponse = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    weather_code: z.array(z.number()),
  }),
});

async function getJson(url: URL, fetcher: Fetcher): Promise<unknown> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Open-Meteo answered ${response.status}`);
  return response.json();
}

/** Places matching what someone typed, for picking one in the editor. */
export async function searchPlaces(
  query: unknown,
  env: EnvBag = process.env,
  fetcher: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
): Promise<Place[]> {
  const name = z.string().trim().min(2, "Type at least two letters").max(80).parse(query);
  const api = endpoints(env);
  const url = new URL(api.geocoding);
  url.search = new URLSearchParams({ name, count: "6", language: "en", format: "json" }).toString();
  if (api.key) url.searchParams.set("apikey", api.key);
  try {
    const body = geocodingResponse.parse(await getJson(url, fetcher));
    return (body.results ?? []).map((r) => ({
      name: r.name,
      region: r.admin1,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  } catch (error) {
    console.error("[weather] place search failed:", error);
    throw new UserError("Couldn't search for places just now. Try again in a minute.", 503);
  }
}

/** The cache key for a place: about a kilometre, which is as precise as weather is. */
export function weatherKey(latitude: number, longitude: number, units: Units): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)},${units}`;
}

const cache = new Map<string, WeatherReport>();
const inFlight = new Map<string, Promise<WeatherReport | null>>();

/**
 * Current weather for a place: fresh from the cache, otherwise from Open-Meteo,
 * otherwise the last reading if it is not yet stale, otherwise null. Never
 * throws: a weather outage must not take a TV's screen down with it.
 */
export async function getWeather(
  input: { latitude: number; longitude: number; units: Units },
  now: Date = new Date(),
  env: EnvBag = process.env,
  fetcher: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
): Promise<WeatherReport | null> {
  const { latitude, longitude } = coordinatesSchema.parse(input);
  const units: Units = input.units === "celsius" ? "celsius" : "fahrenheit";
  const key = weatherKey(latitude, longitude, units);
  const cached = cache.get(key);
  const age = cached ? now.getTime() - Date.parse(cached.fetchedAt) : Infinity;
  if (cached && age < REFRESH_MS) return cached;

  let pending = inFlight.get(key);
  if (!pending) {
    pending = fetchWeather(latitude, longitude, units, now, env, fetcher).finally(() =>
      inFlight.delete(key),
    );
    inFlight.set(key, pending);
  }
  const fresh = await pending;
  if (fresh) {
    if (!cache.has(key) && cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
    cache.set(key, fresh);
    return fresh;
  }
  return cached && age < STALE_AFTER_MS ? cached : null;
}

async function fetchWeather(
  latitude: number,
  longitude: number,
  units: Units,
  now: Date,
  env: EnvBag,
  fetcher: Fetcher,
): Promise<WeatherReport | null> {
  const api = endpoints(env);
  const url = new URL(api.forecast);
  url.search = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: "temperature_2m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    temperature_unit: units,
    timezone: "auto",
    forecast_days: "3",
  }).toString();
  if (api.key) url.searchParams.set("apikey", api.key);
  try {
    const body = forecastResponse.parse(await getJson(url, fetcher));
    return {
      temperature: Math.round(body.current.temperature_2m),
      code: body.current.weather_code,
      isDay: body.current.is_day === 1,
      units,
      daily: body.daily.time.slice(0, 3).map((date, i) => ({
        date,
        high: Math.round(body.daily.temperature_2m_max[i]),
        low: Math.round(body.daily.temperature_2m_min[i]),
        code: body.daily.weather_code[i],
      })),
      fetchedAt: now.toISOString(),
    };
  } catch (error) {
    console.error("[weather] forecast failed:", error);
    return null;
  }
}

/** For tests. */
export function clearWeatherCache(): void {
  cache.clear();
  inFlight.clear();
}
