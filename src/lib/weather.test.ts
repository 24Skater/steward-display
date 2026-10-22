import { describe, expect, it } from "vitest";

import { placeOf } from "./weather";

describe("placeOf", () => {
  it("accepts a real place", () => {
    expect(placeOf({ place: { name: "Nashville", latitude: 36.1, longitude: -86.7 } })).toEqual({
      name: "Nashville",
      latitude: 36.1,
      longitude: -86.7,
      region: undefined,
      country: undefined,
    });
  });

  it("treats anything malformed as no place, instead of crashing a TV", () => {
    const bad: unknown[] = [
      undefined,
      "Nashville",
      { name: "X", latitude: "36", longitude: 0 },
      { name: "X", latitude: 91, longitude: 0 },
      { name: "X", latitude: 0, longitude: Number.NaN },
      { name: { evil: true }, latitude: 0, longitude: 0 },
      { name: "  ", latitude: 0, longitude: 0 },
    ];
    for (const place of bad) expect(placeOf({ place } as never)).toBeUndefined();
  });
});
