import { createServerFn } from "@tanstack/react-start";

import { enforceLimit, limits } from "@/server/http";
import { getWeather, searchPlaces, type Units } from "@/server/weather";
import { signedIn } from "./middleware";

/** Places matching a name, for the weather widget's place picker. */
export const searchPlacesFn = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .validator((input: { query: string }) => input)
  .handler(({ data, context }) => {
    enforceLimit(limits.placeSearch, context.viewer.userId);
    return searchPlaces(data.query);
  });

/** The current reading for a place, for the editor and preview (TVs get theirs in the payload). */
export const getWeatherFn = createServerFn({ method: "GET" })
  .middleware([signedIn])
  .validator((input: { latitude: number; longitude: number; units: Units }) => input)
  .handler(({ data, context }) => {
    enforceLimit(limits.weatherLookup, context.viewer.userId);
    return getWeather({
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      units: data.units === "celsius" ? "celsius" : "fahrenheit",
    });
  });
