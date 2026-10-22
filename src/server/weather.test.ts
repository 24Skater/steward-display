import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearWeatherCache,
  getWeather,
  peekWeather,
  searchPlaces,
  STALE_AFTER_MS,
} from "./weather";

const forecastBody = {
  current: { temperature_2m: 58.6, weather_code: 3, is_day: 1 },
  daily: {
    time: ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"],
    temperature_2m_max: [61.2, 64, 66, 70],
    temperature_2m_min: [44.5, 46, 48, 50],
    weather_code: [3, 61, 0, 1],
  },
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const place = { latitude: 36.1659, longitude: -86.7844, units: "fahrenheit" as const };

beforeEach(clearWeatherCache);

describe("getWeather", () => {
  it("shapes Open-Meteo's answer, rounded, with three days", async () => {
    const fetcher = vi.fn(async (_url: URL) => ok(forecastBody));
    const report = await getWeather(place, new Date("2026-10-21T20:00:00Z"), {}, fetcher);
    expect(report).toMatchObject({ temperature: 59, code: 3, isDay: true, units: "fahrenheit" });
    expect(report?.daily).toEqual([
      { date: "2026-10-21", high: 61, low: 45, code: 3 },
      { date: "2026-10-22", high: 64, low: 46, code: 61 },
      { date: "2026-10-23", high: 66, low: 48, code: 0 },
    ]);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.host).toBe("api.open-meteo.com");
    expect(url.searchParams.get("temperature_unit")).toBe("fahrenheit");
  });

  it("asks once per place per ten minutes, however many screens show it", async () => {
    const fetcher = vi.fn(async (_url: URL) => ok(forecastBody));
    const t0 = new Date("2026-10-21T20:00:00Z");
    await Promise.all([1, 2, 3].map(() => getWeather(place, t0, {}, fetcher)));
    await getWeather(place, new Date(t0.getTime() + 9 * 60_000), {}, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await getWeather(place, new Date(t0.getTime() + 11 * 60_000), {}, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the last reading through an outage, until it is too old to call current", async () => {
    const t0 = new Date("2026-10-21T20:00:00Z");
    await getWeather(place, t0, {}, async () => ok(forecastBody));
    const down = async () => new Response("no", { status: 502 });
    const soon = await getWeather(place, new Date(t0.getTime() + 60 * 60_000), {}, down);
    expect(soon?.temperature).toBe(59);
    const later = await getWeather(place, new Date(t0.getTime() + STALE_AFTER_MS + 1), {}, down);
    expect(later).toBeNull();
  });

  it("never throws on a bad answer, and refuses impossible coordinates", async () => {
    expect(await getWeather(place, new Date(), {}, async () => ok({ nope: true }))).toBeNull();
    await expect(
      getWeather({ latitude: 200, longitude: 0, units: "celsius" }, new Date(), {}),
    ).rejects.toThrow();
  });

  it("uses the commercial endpoints with a key", async () => {
    const fetcher = vi.fn(async (_url: URL) => ok(forecastBody));
    await getWeather(place, new Date(), { OPEN_METEO_API_KEY: "k" }, fetcher);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.host).toBe("customer-api.open-meteo.com");
    expect(url.searchParams.get("apikey")).toBe("k");
  });
});

describe("searchPlaces", () => {
  it("returns places to pick from", async () => {
    const fetcher = async () =>
      ok({
        results: [
          {
            name: "Nashville",
            admin1: "Tennessee",
            country: "United States",
            latitude: 36.17,
            longitude: -86.78,
          },
        ],
      });
    expect(await searchPlaces("Nashville", {}, fetcher)).toEqual([
      {
        name: "Nashville",
        region: "Tennessee",
        country: "United States",
        latitude: 36.17,
        longitude: -86.78,
      },
    ]);
    expect(await searchPlaces("Nowhere", {}, async () => ok({}))).toEqual([]);
  });

  it("explains a failure instead of leaking it", async () => {
    await expect(
      searchPlaces("Nashville", {}, async () => new Response("", { status: 500 })),
    ).rejects.toThrow(/Couldn't search for places/);
    await expect(searchPlaces("x", {})).rejects.toThrow(/at least two letters/);
  });
});

describe("outages and quota", () => {
  it("leaves a failing place alone for a while instead of retrying every poll", async () => {
    const t0 = new Date("2026-10-21T20:00:00Z");
    const down = vi.fn(async (_url: URL) => new Response("no", { status: 503 }));
    expect(await getWeather(place, t0, {}, down)).toBeNull();
    expect(await getWeather(place, new Date(t0.getTime() + 30_000), {}, down)).toBeNull();
    expect(down).toHaveBeenCalledTimes(1);
    await getWeather(place, new Date(t0.getTime() + 3 * 60_000), {}, down);
    expect(down).toHaveBeenCalledTimes(2);
  });

  it("backs off longer when Open-Meteo says too many requests", async () => {
    const t0 = new Date("2026-10-21T20:00:00Z");
    const limited = vi.fn(async (_url: URL) => new Response("slow down", { status: 429 }));
    await getWeather(place, t0, {}, limited);
    await getWeather(place, new Date(t0.getTime() + 5 * 60_000), {}, limited);
    expect(limited).toHaveBeenCalledTimes(1);
  });

  it("peeks without waiting, and refreshes in the background", async () => {
    const t0 = new Date("2026-10-21T20:00:00Z");
    let release: () => void = () => {};
    const slow = vi.fn(
      (_url: URL) =>
        new Promise<Response>((resolve) => {
          release = () => resolve(ok(forecastBody));
        }),
    );
    // Nothing cached: answers at once with nothing, and starts a fetch.
    expect(peekWeather(place, t0, slow)).toBeNull();
    expect(slow).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(peekWeather(place, t0, slow)?.temperature).toBe(59));
    expect(slow).toHaveBeenCalledTimes(1);
  });
});
