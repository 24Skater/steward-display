/**
 * A fixed-window counter per key, in memory.
 *
 * In memory is honest for this app: one container serves a church, and the
 * hosted platform runs one replica per app behind Caddy. If that changes, the
 * limiter moves to Postgres, not to a new service.
 */
export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets, for a Retry-After header. */
  retryAfter: number;
}

interface Window {
  count: number;
  resetsAt: number;
}

const MAX_KEYS = 10_000;

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly rule: RateLimitRule,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): RateLimitResult {
    const now = this.now();
    const current = this.windows.get(key);
    const window =
      current && current.resetsAt > now
        ? { count: current.count + 1, resetsAt: current.resetsAt }
        : { count: 1, resetsAt: now + this.rule.windowMs };

    if (!current && this.windows.size >= MAX_KEYS) this.sweep(now);
    this.windows.set(key, window);

    return {
      ok: window.count <= this.rule.limit,
      retryAfter: Math.max(1, Math.ceil((window.resetsAt - now) / 1000)),
    };
  }

  /** Forgets a key, after a successful sign-in for example. */
  reset(key: string): void {
    this.windows.delete(key);
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetsAt <= now) this.windows.delete(key);
    }
    // Still full of live windows: drop the oldest rather than grow without bound.
    while (this.windows.size >= MAX_KEYS) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}

const MINUTE = 60_000;

/** The limits, in one place so they can be read at a glance. */
export const limits = {
  /** Per IP and email: slows guessing one account's password. */
  signIn: new RateLimiter({ limit: 10, windowMs: 15 * MINUTE }),
  /** Per IP: one installation is set up once. */
  setup: new RateLimiter({ limit: 10, windowMs: 15 * MINUTE }),
  /** Per IP: a TV asks for a code, and asks again when it expires. */
  pairStart: new RateLimiter({ limit: 20, windowMs: 15 * MINUTE }),
  /** Per signed-in user: entering codes. Guessing a live one would take ~10^7 tries. */
  pairClaim: new RateLimiter({ limit: 20, windowMs: 15 * MINUTE }),
  /** Per IP: TV status and screen polling, generous because a lobby may hold a dozen TVs. */
  tvPoll: new RateLimiter({ limit: 600, windowMs: 15 * MINUTE }),
};
