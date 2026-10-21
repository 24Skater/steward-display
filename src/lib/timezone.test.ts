import { describe, expect, it } from "vitest";

import { wallClock, wallTimeToInstant } from "./timezone";

describe("timezone", () => {
  it("reads a wall clock in another zone", () => {
    const noonUtc = new Date("2026-07-01T12:00:00Z");
    expect(wallClock(noonUtc, "America/New_York")).toMatchObject({ hour: 8, minute: 0 });
    expect(wallClock(noonUtc, "Asia/Kolkata")).toMatchObject({ hour: 17, minute: 30 });
  });

  it("turns a church's wall time into the right instant, either side of DST", () => {
    expect(wallTimeToInstant("2026-12-24T18:00", "America/New_York")?.toISOString()).toBe(
      "2026-12-24T23:00:00.000Z",
    );
    expect(wallTimeToInstant("2026-07-04T18:00", "America/New_York")?.toISOString()).toBe(
      "2026-07-04T22:00:00.000Z",
    );
    expect(wallTimeToInstant("2026-07-04T18:00", "Europe/London")?.toISOString()).toBe(
      "2026-07-04T17:00:00.000Z",
    );
  });

  it("returns null for nonsense", () => {
    expect(wallTimeToInstant("not a date", "UTC")).toBeNull();
  });
});
