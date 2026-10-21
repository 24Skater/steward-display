import { useEffect, useRef, useState } from "react";

import type { Screen } from "@/types";

/**
 * The paired TV's loop.
 *
 * Unpaired: ask for a code, show it, poll until someone types it in, keep the
 * device token. Paired: poll for the screen with its ETag, so almost every poll
 * is a 304. Offline: keep showing the last screen that loaded, from local
 * storage, through reboots. A 401 means the TV was unpaired: forget everything
 * and show a new code.
 */

export interface TvPayload {
  deviceName: string;
  timezone: string;
  screen: Screen | null;
}

export type TvState =
  | { mode: "booting" }
  | { mode: "pairing"; code: string | null; error: boolean }
  | { mode: "paired"; payload: TvPayload; offline: boolean };

const KEYS = {
  token: "steward.tv.token",
  payload: "steward.tv.payload",
  etag: "steward.tv.etag",
} as const;

export const SCREEN_POLL_MS = 30_000;
const PAIR_POLL_MS = 3_000;
const RETRY_MS = 10_000;
/** Consecutive failed polls before the TV admits, with a small dot, that it is offline. */
const OFFLINE_AFTER = 2;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage full or disabled: the TV still works, it just won't survive a reboot offline.
  }
}

function readPayload(): TvPayload | null {
  const raw = read(KEYS.payload);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TvPayload;
  } catch {
    return null;
  }
}

function forget(): void {
  write(KEYS.token, null);
  write(KEYS.payload, null);
  write(KEYS.etag, null);
}

/** Spreads a dozen TVs' polls apart so they don't all arrive on the same second. */
function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.2);
}

export function useTvPlayer(): TvState {
  const [state, setState] = useState<TvState>({ mode: "booting" });
  const failures = useRef(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (fn: () => void, ms: number) => {
      if (!stopped) timer = setTimeout(fn, ms);
    };

    async function pollScreen(): Promise<void> {
      const token = read(KEYS.token);
      if (!token) return startPairing();
      const etag = read(KEYS.etag);
      try {
        const response = await fetch("/api/tv/screen", {
          headers: { authorization: `Bearer ${token}`, ...(etag ? { "if-none-match": etag } : {}) },
          cache: "no-store",
        });
        if (response.status === 401) {
          forget();
          return startPairing();
        }
        if (response.status === 200) {
          const payload = (await response.json()) as TvPayload;
          write(KEYS.payload, JSON.stringify(payload));
          write(KEYS.etag, response.headers.get("etag"));
          failures.current = 0;
          setState({ mode: "paired", payload, offline: false });
        } else if (response.status === 304) {
          failures.current = 0;
          setState((s) => (s.mode === "paired" && s.offline ? { ...s, offline: false } : s));
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch {
        failures.current++;
        const last = readPayload();
        if (last) {
          setState({ mode: "paired", payload: last, offline: failures.current >= OFFLINE_AFTER });
        }
      }
      later(() => void pollScreen(), jitter(SCREEN_POLL_MS));
    }

    async function startPairing(): Promise<void> {
      setState({ mode: "pairing", code: null, error: false });
      try {
        const response = await fetch("/api/tv/pair", { method: "POST", cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const started = (await response.json()) as { code: string; pollSecret: string };
        setState({ mode: "pairing", code: started.code, error: false });
        later(() => void pollPairing(started.pollSecret), PAIR_POLL_MS);
      } catch {
        setState({ mode: "pairing", code: null, error: true });
        later(() => void startPairing(), RETRY_MS);
      }
    }

    async function pollPairing(pollSecret: string): Promise<void> {
      try {
        const response = await fetch("/api/tv/pair/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pollSecret }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = (await response.json()) as
          | { status: "pending" }
          | { status: "expired" }
          | { status: "paired"; deviceToken: string };
        if (result.status === "paired") {
          write(KEYS.token, result.deviceToken);
          write(KEYS.etag, null);
          return pollScreen();
        }
        if (result.status === "expired") return startPairing();
      } catch {
        // A blip while waiting: keep showing the code and ask again.
      }
      later(() => void pollPairing(pollSecret), PAIR_POLL_MS);
    }

    // Show the last good screen straight away, before the network answers.
    const last = read(KEYS.token) ? readPayload() : null;
    if (last) setState({ mode: "paired", payload: last, offline: false });
    void pollScreen();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return state;
}

/** Keeps the TV's screen from sleeping where the browser allows it. */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not allowed or not supported: TVs usually have their own sleep settings.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
}

/** Lets the TV page work from cache when it is reloaded with no network. */
export function useTvServiceWorker(): void {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    navigator.serviceWorker.register("/tv-sw.js", { scope: "/tv" }).catch(() => {
      // Without it the TV still works online, and still remembers its last screen.
    });
  }, []);
}
