import { generateKeyPairSync, createPublicKey, randomUUID } from "node:crypto";
import { SignJWT, importPKCS8, exportJWK, type JWK } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformClient, PlatformUnavailableError } from "./client";
import { canWrite } from "./entitlement-state";

const CONSOLE_URL = "https://console.example.org";
const ORG_ID = "0a4c2b8e-5f1d-4a2b-9c3e-7d8f1a2b3c4d";
const SERVICE_TOKEN = "stw_svc_table_secret";

const HOUR = 60 * 60 * 1000;

interface Key {
  kid: string;
  pkcs8: string;
  jwk: JWK;
}

async function makeKey(kid: string = randomUUID()): Promise<Key> {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const jwk = await exportJWK(createPublicKey(pkcs8));
  return { kid, pkcs8, jwk: { ...jwk, kid, alg: "EdDSA", use: "sig" } };
}

async function mintToken(
  key: Key,
  entitlements: Record<string, unknown>,
  nowMs: number,
): Promise<string> {
  const privateKey = await importPKCS8(key.pkcs8, "EdDSA");
  const iat = Math.floor(nowMs / 1000);

  return new SignJWT({
    org: { id: ORG_ID, slug: "grace", status: "ACTIVE" },
    entitlements,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: "JWT" })
    .setIssuer(CONSOLE_URL)
    .setAudience("steward-apps")
    .setSubject(ORG_ID)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 300)
    .sign(privateKey);
}

const ACTIVE_TABLE = { table: { state: "ACTIVE", limits: { storageGb: 25 }, expiresAt: null } };

/**
 * A stand-in console. Tracks call counts so the tests can assert on caching,
 * and can be switched offline mid-test to exercise the fail-open path.
 */
function makeConsole(key: Key, entitlements: Record<string, unknown> = ACTIVE_TABLE) {
  const state = {
    online: true,
    jwksCalls: 0,
    entitlementCalls: 0,
    keys: [key],
    entitlements,
    signWith: key,
    nowMs: Date.parse("2026-09-03T12:00:00Z"),
  };

  const fetchImpl = (async (url: string | URL) => {
    if (!state.online) throw new Error("ECONNREFUSED");
    const href = typeof url === "string" ? url : url.href;

    if (href.endsWith("/.well-known/jwks.json")) {
      state.jwksCalls += 1;
      return new Response(JSON.stringify({ keys: state.keys.map((k) => k.jwk) }), { status: 200 });
    }

    state.entitlementCalls += 1;
    const token = await mintToken(state.signWith, state.entitlements, state.nowMs);
    return new Response(JSON.stringify({ token, issuer: CONSOLE_URL, expiresIn: 300 }), {
      status: 200,
    });
  }) as unknown as typeof globalThis.fetch;

  return { state, fetchImpl };
}

function makeClient(server: ReturnType<typeof makeConsole>, overrides = {}) {
  return new PlatformClient({
    consoleUrl: CONSOLE_URL,
    serviceToken: SERVICE_TOKEN,
    fetch: server.fetchImpl,
    now: () => server.state.nowMs,
    ...overrides,
  });
}

describe("fetching and verifying", () => {
  let key: Key;

  beforeEach(async () => {
    key = await makeKey();
  });

  it("returns the entitlements the console signed", async () => {
    const server = makeConsole(key);
    const client = makeClient(server);

    const snapshot = await client.getSnapshot(ORG_ID);

    expect(snapshot.org.slug).toBe("grace");
    expect(snapshot.entitlements.table?.state).toBe("ACTIVE");
    expect(snapshot.entitlements.table?.limits).toEqual({ storageGb: 25 });
    expect(snapshot.stale).toBe(false);
    expect(snapshot.degraded).toBe(false);
  });

  it("sends the service token as a bearer credential", async () => {
    const server = makeConsole(key);
    const seen: Array<Record<string, string>> = [];
    const spy = (async (url: string | URL, init?: RequestInit) => {
      seen.push((init?.headers ?? {}) as Record<string, string>);
      return server.fetchImpl(url as string, init);
    }) as unknown as typeof globalThis.fetch;

    await makeClient(server, { fetch: spy }).getSnapshot(ORG_ID);

    expect(seen.some((h) => h.authorization === `Bearer ${SERVICE_TOKEN}`)).toBe(true);
  });

  it("rejects a token signed by a key the JWKS does not publish", async () => {
    const server = makeConsole(key);
    server.state.signWith = await makeKey(); // not in server.state.keys
    const client = makeClient(server);

    await expect(client.getSnapshot(ORG_ID)).rejects.toThrow(PlatformUnavailableError);
  });

  it("rejects a token whose issuer is not the console it asked", async () => {
    const server = makeConsole(key);
    const badIssuer = (async (url: string | URL) => {
      const href = typeof url === "string" ? url : url.href;
      if (href.endsWith("/.well-known/jwks.json")) {
        return new Response(JSON.stringify({ keys: [key.jwk] }), { status: 200 });
      }
      const token = await mintToken(key, ACTIVE_TABLE, server.state.nowMs);
      // Same signed token, but the client is told to expect a different issuer.
      return new Response(JSON.stringify({ token, issuer: "https://evil.example.org" }), {
        status: 200,
      });
    }) as unknown as typeof globalThis.fetch;

    await expect(makeClient(server, { fetch: badIssuer }).getSnapshot(ORG_ID)).rejects.toThrow(
      PlatformUnavailableError,
    );
  });

  it("surfaces a non-200 from the console", async () => {
    const server = makeConsole(key);
    const failing = (async (url: string | URL) => {
      const href = typeof url === "string" ? url : url.href;
      if (href.endsWith("/.well-known/jwks.json")) {
        return new Response(JSON.stringify({ keys: [key.jwk] }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    }) as unknown as typeof globalThis.fetch;

    await expect(makeClient(server, { fetch: failing }).getSnapshot(ORG_ID)).rejects.toThrow(
      PlatformUnavailableError,
    );
  });
});

describe("caching", () => {
  it("serves from cache inside the refresh interval", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const client = makeClient(server, { refreshIntervalMs: 60_000 });

    await client.getSnapshot(ORG_ID);
    server.state.nowMs += 30_000;
    await client.getSnapshot(ORG_ID);

    expect(server.state.entitlementCalls).toBe(1);
  });

  it("refreshes once the interval has passed", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const client = makeClient(server, { refreshIntervalMs: 60_000 });

    await client.getSnapshot(ORG_ID);
    server.state.nowMs += 61_000;
    await client.getSnapshot(ORG_ID);

    expect(server.state.entitlementCalls).toBe(2);
  });

  it("collapses concurrent refreshes into a single request", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const client = makeClient(server);

    await Promise.all([
      client.getSnapshot(ORG_ID),
      client.getSnapshot(ORG_ID),
      client.getSnapshot(ORG_ID),
    ]);

    expect(server.state.entitlementCalls).toBe(1);
  });

  it("fetches the JWKS once and reuses it across refreshes", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const client = makeClient(server, { refreshIntervalMs: 0 });

    await client.getSnapshot(ORG_ID);
    server.state.nowMs += 1000;
    await client.getSnapshot(ORG_ID);

    expect(server.state.entitlementCalls).toBe(2);
    expect(server.state.jwksCalls).toBe(1);
  });

  it("refetches the JWKS when a token names an unknown key, so rotation is not a 24h outage", async () => {
    const key = await makeKey("key-a");
    const server = makeConsole(key);
    const client = makeClient(server, { refreshIntervalMs: 0 });

    await client.getSnapshot(ORG_ID);
    expect(server.state.jwksCalls).toBe(1);

    // The console rotates: a new key signs, and the JWKS now publishes both.
    const rotated = await makeKey("key-b");
    server.state.keys = [key, rotated];
    server.state.signWith = rotated;
    server.state.nowMs += 1000;

    const snapshot = await client.getSnapshot(ORG_ID);

    expect(snapshot.entitlements.table?.state).toBe("ACTIVE");
    expect(server.state.jwksCalls).toBe(2);
  });
});

describe("fail open", () => {
  it("keeps honouring the last entitlement while the console is down", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const warnings: string[] = [];
    const client = makeClient(server, {
      refreshIntervalMs: 60_000,
      onWarning: (m: string) => warnings.push(m),
    });

    await client.getSnapshot(ORG_ID);

    server.state.online = false;
    server.state.nowMs += 6 * HOUR;
    const snapshot = await client.getSnapshot(ORG_ID);

    // Six hours into an outage, a church is still fully operational.
    expect(snapshot.entitlements.table?.state).toBe("ACTIVE");
    expect(canWrite(snapshot.entitlements.table?.state)).toBe(true);
    expect(snapshot.stale).toBe(true);
    expect(snapshot.degraded).toBe(false);
    expect(warnings).toHaveLength(1);
  });

  it("degrades to read-only once the outage outlasts the fail-open window", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const client = makeClient(server, { refreshIntervalMs: 60_000, failOpenWindowMs: 24 * HOUR });

    await client.getSnapshot(ORG_ID);

    server.state.online = false;
    server.state.nowMs += 25 * HOUR;
    const snapshot = await client.getSnapshot(ORG_ID);

    expect(snapshot.entitlements.table?.state).toBe("READ_ONLY");
    expect(canWrite(snapshot.entitlements.table?.state)).toBe(false);
    expect(snapshot.degraded).toBe(true);
  });

  it("does not restore access to a REVOKED product when degrading", async () => {
    const key = await makeKey();
    const server = makeConsole(key, {
      table: { state: "ACTIVE", limits: {}, expiresAt: null },
      display: { state: "REVOKED", limits: {}, expiresAt: null },
    });
    const client = makeClient(server, { refreshIntervalMs: 60_000, failOpenWindowMs: 24 * HOUR });

    await client.getSnapshot(ORG_ID);
    server.state.online = false;
    server.state.nowMs += 25 * HOUR;
    const snapshot = await client.getSnapshot(ORG_ID);

    expect(snapshot.entitlements.table?.state).toBe("READ_ONLY");
    // An outage must never be a way to get back into a product you lost.
    expect(snapshot.entitlements.display?.state).toBe("REVOKED");
  });

  it("throws when the console is unreachable and nothing was ever cached", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    server.state.online = false;

    await expect(makeClient(server).getSnapshot(ORG_ID)).rejects.toThrow(PlatformUnavailableError);
  });

  it("recovers silently once the console returns", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const client = makeClient(server, { refreshIntervalMs: 60_000 });

    await client.getSnapshot(ORG_ID);
    server.state.online = false;
    server.state.nowMs += 2 * HOUR;
    expect((await client.getSnapshot(ORG_ID)).stale).toBe(true);

    server.state.online = true;
    server.state.nowMs += 61_000;
    const snapshot = await client.getSnapshot(ORG_ID);

    expect(snapshot.stale).toBe(false);
    expect(snapshot.entitlements.table?.state).toBe("ACTIVE");
  });
});

describe("getState", () => {
  it("returns undefined for a product the org never bought", async () => {
    const key = await makeKey();
    const client = makeClient(makeConsole(key));

    expect(await client.getState(ORG_ID, "table")).toBe("ACTIVE");
    expect(await client.getState(ORG_ID, "chms")).toBeUndefined();
  });
});

describe("request timeouts", () => {
  it("aborts a hung console rather than holding the request path open", async () => {
    const key = await makeKey();
    const server = makeConsole(key);
    const hanging = ((_url: string | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof globalThis.fetch;

    vi.useFakeTimers();
    try {
      const client = makeClient(server, { fetch: hanging, requestTimeoutMs: 5_000 });
      const pending = client.getSnapshot(ORG_ID);
      const assertion = expect(pending).rejects.toThrow(PlatformUnavailableError);
      await vi.advanceTimersByTimeAsync(5_001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
