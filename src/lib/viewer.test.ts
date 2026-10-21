import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth.functions", () => ({ getAppState: vi.fn() }));
const { safeNext } = await import("./viewer");

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/tvs")).toBe("/tvs");
    expect(safeNext("/screens/abc/edit?x=1#w")).toBe("/screens/abc/edit?x=1#w");
  });

  it("refuses anything a browser would take off-site", () => {
    const offSite = [
      "//evil.com",
      "/\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "https://evil.com",
      "evil.com",
      42,
      null,
    ];
    for (const bad of offSite) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
