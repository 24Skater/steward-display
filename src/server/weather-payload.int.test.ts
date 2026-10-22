import { beforeEach, expect, it, vi } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";

// The payload reads cached weather with peekWeather; stub it so no test calls Open-Meteo.
let fetchedAt = "2026-10-21T20:00:00.000Z";
const peekWeather = vi.fn((input: { latitude: number; units: string }) =>
  input.latitude > 80
    ? null
    : {
        temperature: 59,
        code: 3,
        isDay: true,
        units: input.units,
        daily: [],
        fetchedAt,
      },
);
vi.mock("./weather", async (original) => ({
  ...(await original<typeof import("./weather")>()),
  peekWeather: (input: { latitude: number; units: string }) => peekWeather(input),
}));

const { createScreen } = await import("./screens");
const { payloadForDevice } = await import("./devices");

const weatherWidget = (id: string, config: Record<string, unknown>) => ({
  id,
  widgetType: "weather",
  x: 0,
  y: 0,
  w: 6,
  h: 4,
  config,
});

const screenWith = (widgets: ReturnType<typeof weatherWidget>[]) => ({
  name: "Lobby",
  orientation: "landscape",
  resolution: "1920x1080",
  backgroundColor: "#000000",
  widgets,
});

describeDb("weather in the TV payload", () => {
  beforeEach(async () => {
    await resetDatabase();
    peekWeather.mockClear();
  });

  it("carries one reading per place, skips unset or unavailable places, and re-tags on refresh", async () => {
    const org = await makeOrg();
    const nashville = { name: "Nashville", latitude: 36.1659, longitude: -86.7844 };
    const screen = await asOrg(org, () =>
      createScreen(
        screenWith([
          weatherWidget("a", { place: nashville, units: "fahrenheit" }),
          weatherWidget("b", { place: nashville, units: "fahrenheit" }), // same place: one reading
          weatherWidget("c", { place: nashville, units: "celsius" }),
          weatherWidget("d", {}), // no place yet
          weatherWidget("e", { place: { name: "Pole", latitude: 89, longitude: 0 } }), // unavailable
          weatherWidget("f", { place: { name: "Bad", latitude: "36", longitude: 0 } }), // malformed
        ]),
      ),
    );
    const device = { id: "tv", name: "Lobby TV", screenId: screen.id };

    const first = await asOrg(org, () => payloadForDevice(device));
    expect(Object.keys(first.payload.weather).sort()).toEqual([
      "36.17,-86.78,celsius",
      "36.17,-86.78,fahrenheit",
    ]);
    expect(peekWeather).toHaveBeenCalledTimes(3);

    const same = await asOrg(org, () => payloadForDevice(device));
    expect(same.etag).toBe(first.etag);

    fetchedAt = "2026-10-21T20:10:00.000Z";
    const refreshed = await asOrg(org, () => payloadForDevice(device));
    expect(refreshed.etag).not.toBe(first.etag);
  });

  it("asks about at most ten places for one screen", async () => {
    const org = await makeOrg();
    const many = Array.from({ length: 30 }, (_, i) =>
      weatherWidget(`w${i}`, { place: { name: `P${i}`, latitude: i, longitude: i } }),
    );
    const screen = await asOrg(org, () => createScreen(screenWith(many)));
    await asOrg(org, () => payloadForDevice({ id: "tv", name: "TV", screenId: screen.id }));
    expect(peekWeather).toHaveBeenCalledTimes(10);
  });
});
