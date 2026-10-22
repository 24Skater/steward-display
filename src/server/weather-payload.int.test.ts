import { beforeEach, expect, it, vi } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";

// The payload's weather comes from getWeather; stub it so no test calls Open-Meteo.
let fetchedAt = "2026-10-21T20:00:00.000Z";
const getWeather = vi.fn(async (input: { latitude: number; units: string }) =>
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
  getWeather: (input: { latitude: number; units: string }) => getWeather(input),
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

describeDb("weather in the TV payload", () => {
  beforeEach(async () => {
    await resetDatabase();
    getWeather.mockClear();
  });

  it("carries one reading per place, skips unset or unavailable places, and re-tags on refresh", async () => {
    const org = await makeOrg();
    const nashville = { name: "Nashville", latitude: 36.1659, longitude: -86.7844 };
    const screen = await asOrg(org, () =>
      createScreen({
        name: "Lobby",
        orientation: "landscape",
        resolution: "1920x1080",
        backgroundColor: "#000000",
        widgets: [
          weatherWidget("a", { place: nashville, units: "fahrenheit" }),
          weatherWidget("b", { place: nashville, units: "fahrenheit" }), // same place: one reading
          weatherWidget("c", { place: nashville, units: "celsius" }),
          weatherWidget("d", {}), // no place yet
          weatherWidget("e", { place: { name: "Pole", latitude: 89, longitude: 0 } }), // unavailable
        ],
      }),
    );
    const device = { id: "tv", name: "Lobby TV", screenId: screen.id };

    const first = await asOrg(org, () => payloadForDevice(device));
    expect(Object.keys(first.payload.weather).sort()).toEqual([
      "36.17,-86.78,celsius",
      "36.17,-86.78,fahrenheit",
    ]);
    expect(getWeather).toHaveBeenCalledTimes(3);

    const same = await asOrg(org, () => payloadForDevice(device));
    expect(same.etag).toBe(first.etag);

    fetchedAt = "2026-10-21T20:10:00.000Z";
    const refreshed = await asOrg(org, () => payloadForDevice(device));
    expect(refreshed.etag).not.toBe(first.etag);
  });
});
