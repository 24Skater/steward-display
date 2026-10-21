import { describe, expect, it } from "vitest";

import { clientIpFrom } from "./client-ip";
import { bodySizeRefusal, isSameOriginWrite } from "./gate";
import { extractTenantSlug } from "./platform-domain";
import { hashPassword, verifyPassword } from "./password";
import { RateLimiter } from "./rate-limit";
import { parseScreenDocument } from "./schemas";
import {
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  hashSecret,
  newPairingCode,
  newSecret,
  normalizePairingCode,
} from "./secrets";
import { sessionCookie } from "./sessions";

describe("extractTenantSlug", () => {
  const env = { PLATFORM_ROOT_DOMAIN: "example.org" };

  it("reads the church from a Display host", () => {
    expect(extractTenantSlug("grace-stewarddisplay.app.example.org", env)).toBe("grace");
    expect(extractTenantSlug("GRACE-stewarddisplay.app.example.org:443", env)).toBe("grace");
  });

  it("refuses another Steward app's host, the bare root and lookalikes", () => {
    expect(extractTenantSlug("grace-stewardchms.app.example.org", env)).toBeNull();
    expect(extractTenantSlug("example.org", env)).toBeNull();
    expect(extractTenantSlug("grace-stewarddisplay.app.example.org.evil.test", env)).toBeNull();
    expect(extractTenantSlug("-stewarddisplay.app.example.org", env)).toBeNull();
  });

  it("is null on a self-hosted install", () => {
    expect(extractTenantSlug("grace-stewarddisplay.app.example.org", {})).toBeNull();
  });
});

describe("passwords", () => {
  it("verifies the right password and refuses the wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
  });

  it("salts, so one password never hashes the same twice", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("refuses a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "plaintext")).toBe(false);
  });
});

describe("secrets and pairing codes", () => {
  it("makes long, prefixed, unique secrets and hashes them stably", () => {
    const a = newSecret("sdt");
    expect(a).toMatch(/^sdt_[A-Za-z0-9_-]{43}$/);
    expect(newSecret("sdt")).not.toBe(a);
    expect(hashSecret(a)).toBe(hashSecret(a));
    expect(hashSecret(a)).toHaveLength(64);
  });

  it("makes codes only from the readable alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = newPairingCode();
      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
      for (const ch of code) expect(PAIRING_ALPHABET).toContain(ch);
    }
  });

  it("accepts a code typed in lower case with spaces or a dash", () => {
    expect(normalizePairingCode(" k7m-4qx ")).toBe("K7M4QX");
  });
});

describe("RateLimiter", () => {
  it("allows the limit, refuses the next, and resets after the window", () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 2, windowMs: 1000 }, () => now);
    expect(limiter.hit("ip").ok).toBe(true);
    expect(limiter.hit("ip").ok).toBe(true);
    const third = limiter.hit("ip");
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBe(1);
    expect(limiter.hit("other").ok).toBe(true);
    now = 1001;
    expect(limiter.hit("ip").ok).toBe(true);
  });
});

describe("sessionCookie", () => {
  it("is HttpOnly, Lax and Secure when asked", () => {
    const cookie = sessionCookie("tok", { secure: true, expiresAt: new Date(0) });
    expect(cookie).toContain("__Host-sd_session=tok");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("clears with Max-Age=0", () => {
    expect(sessionCookie(null, { secure: false })).toContain("Max-Age=0");
  });
});

describe("parseScreenDocument", () => {
  const base = {
    name: "Lobby",
    orientation: "landscape",
    resolution: "1920x1080",
    backgroundColor: "#0B1220",
    widgets: [],
  };

  it("accepts a plain screen", () => {
    expect(parseScreenDocument(base).name).toBe("Lobby");
  });

  it("refuses a javascript: address in a widget, which a TV would otherwise load", () => {
    const doc = {
      ...base,
      widgets: [
        {
          id: "w1",
          widgetType: "image",
          x: 0,
          y: 0,
          w: 4,
          h: 4,
          config: { src: "javascript:alert(1)" },
        },
      ],
    };
    expect(() => parseScreenDocument(doc)).toThrow(/http/);
  });

  it("refuses a screen with no name and an unknown widget type", () => {
    expect(() => parseScreenDocument({ ...base, name: "  " })).toThrow();
    expect(() =>
      parseScreenDocument({
        ...base,
        widgets: [{ id: "w", widgetType: "iframe", x: 0, y: 0, w: 1, h: 1, config: {} }],
      }),
    ).toThrow();
  });

  it("refuses a document over the size ceiling", () => {
    const doc = {
      ...base,
      widgets: Array.from({ length: 100 }, (_, i) => ({
        id: `w${i}`,
        widgetType: "text",
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        config: { text: "x".repeat(3000) },
      })),
    };
    expect(() => parseScreenDocument(doc)).toThrow(/too large/);
  });
});

describe("isSameOriginWrite", () => {
  const req = (method: string, headers: Record<string, string>) =>
    new Request("https://grace.example/_serverFn/x", { method, headers });

  it("lets reads through and same-site writes", () => {
    expect(isSameOriginWrite(req("GET", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isSameOriginWrite(req("POST", { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginWrite(req("POST", { origin: "https://grace.example" }))).toBe(true);
  });

  it("refuses cross-site writes, by Sec-Fetch-Site or by Origin", () => {
    expect(isSameOriginWrite(req("POST", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginWrite(req("POST", { "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginWrite(req("POST", { origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginWrite(req("POST", { origin: "null" }))).toBe(false);
  });
});

describe("bodySizeRefusal", () => {
  const post = (path: string, length: string | null) =>
    new Request(`https://grace.example${path}`, {
      method: "POST",
      body: "x",
      headers: length === null ? {} : { "content-length": length },
    });

  it("refuses oversized and unknown-length bodies, smaller limits for TVs", () => {
    expect(bodySizeRefusal(new Request("https://grace.example/"))).toBeNull();
    expect(bodySizeRefusal(post("/_serverFn/x", "1000"))).toBeNull();
    expect(bodySizeRefusal(post("/_serverFn/x", String(9 * 1024 * 1024)))).toBe(413);
    expect(bodySizeRefusal(post("/api/tv/pair/status", "5000"))).toBe(413);
  });
});

describe("style values", () => {
  const withStyle = (style: Record<string, unknown>, backgroundColor = "#0B1220") => ({
    name: "Lobby",
    orientation: "landscape",
    resolution: "1920x1080",
    backgroundColor,
    widgets: [{ id: "w", widgetType: "text", x: 0, y: 0, w: 1, h: 1, config: {}, style }],
  });

  it("accepts real colours and sizes", () => {
    expect(() =>
      parseScreenDocument(
        withStyle({ backgroundColor: "rgba(0, 0, 0, 0.5)", borderRadius: "16px" }),
      ),
    ).not.toThrow();
    expect(() => parseScreenDocument(withStyle({ textColor: "currentColor" }))).not.toThrow();
  });

  it("refuses anything that would smuggle more CSS in", () => {
    expect(() => parseScreenDocument(withStyle({}, "red; background-image: url(x)"))).toThrow();
    expect(() =>
      parseScreenDocument(withStyle({ borderRadius: "8px; position: fixed" })),
    ).toThrow();
  });
});

describe("clientIpFrom", () => {
  it("ignores X-Forwarded-For unless a proxy is trusted", () => {
    expect(clientIpFrom("10.0.0.5", "1.2.3.4", {})).toBe("10.0.0.5");
  });

  it("reads the hop the proxy added, not what the visitor typed", () => {
    const env = { TRUST_PROXY: "true" };
    // Visitor sent "6.6.6.6"; the proxy appended the real address.
    expect(clientIpFrom("10.0.0.5", "6.6.6.6, 203.0.113.9", env)).toBe("203.0.113.9");
    expect(
      clientIpFrom("10.0.0.5", "6.6.6.6, 198.51.100.2, 10.0.0.9", {
        ...env,
        TRUSTED_PROXY_HOPS: "2",
      }),
    ).toBe("198.51.100.2");
    expect(clientIpFrom("10.0.0.5", null, env)).toBe("10.0.0.5");
  });
});

describe("bodySizeRefusal edge cases", () => {
  it("lets an empty POST through and refuses chunked bodies of unknown length", () => {
    const empty = new Request("https://grace.example/api/tv/pair", { method: "POST", body: "" });
    expect(bodySizeRefusal(empty)).toBeNull();
    const chunked = new Request("https://grace.example/api/tv/pair", {
      method: "POST",
      body: "x",
      headers: { "transfer-encoding": "chunked" },
    });
    expect(bodySizeRefusal(chunked)).toBe(411);
  });
});
