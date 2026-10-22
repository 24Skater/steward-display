import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

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
      // Dot segments that resolve to a path starting "//".
      "/.//evil.com",
      "/..//evil.com",
      "/a/..//evil.com",
      "/%2e//evil.com",
      "/%2e%2e//evil.com",
      42,
      null,
    ];
    for (const bad of offSite) {
      expect(safeNext(bad), String(bad)).toBe("/");
    }
  });

  it("gives the same answer when applied twice", () => {
    for (const input of ["/tvs", "/.//evil.com", "/a/../b?c=d", "//x"]) {
      expect(safeNext(safeNext(input))).toBe(safeNext(input));
    }
  });
});
