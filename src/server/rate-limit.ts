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
  /** Per IP, regardless of email: caps how much scrypt one address can make us run. */
  signInPerIp: new RateLimiter({ limit: 50, windowMs: 15 * MINUTE }),
  /** Per address: a TV asks for a code, and again every ten minutes while unpaired. */
  pairStart: new RateLimiter({ limit: 30, windowMs: 15 * MINUTE }),
  /**
   * Per signed-in user: entering codes. A code is one of 25^6 (~244 million),
   * so 20 tries in 15 minutes makes guessing a live one hopeless.
   */
  pairClaim: new RateLimiter({ limit: 20, windowMs: 15 * MINUTE }),
  /** Per pairing: a waiting TV polls every 3 s, about 300 times a window. */
  tvPairPoll: new RateLimiter({ limit: 400, windowMs: 15 * MINUTE }),
  /** Per paired TV: polls every ~30 s, about 30 a window; room for reloads. */
  tvScreenPoll: new RateLimiter({ limit: 120, windowMs: 15 * MINUTE }),
  /** Per owner: invitations sent. Enough for a whole team in one sitting. */
  invite: new RateLimiter({ limit: 30, windowMs: 60 * MINUTE }),
  /** Per address: reset requests and using emailed links. */
  emailLinks: new RateLimiter({ limit: 10, windowMs: 15 * MINUTE }),
  /** Per church and email address: reset emails, so nobody can flood one inbox. */
  resetPerEmail: new RateLimiter({ limit: 3, windowMs: 60 * MINUTE }),
  /** Per person: confirmation emails, separate so they never use up someone's resets. */
  verifyPerUser: new RateLimiter({ limit: 3, windowMs: 60 * MINUTE }),
  /** Per invited address at a church: re-invitations, so one inbox cannot be flooded. */
  invitePerRecipient: new RateLimiter({ limit: 3, windowMs: 24 * 60 * MINUTE }),
  /**
   * Accepting invitations: per address and link (wrong-password retries), and a
   * looser cap per address, because a whole volunteer team may join from one
   * church Wi-Fi after Sunday training.
   */
  acceptPerLink: new RateLimiter({ limit: 10, windowMs: 15 * MINUTE }),
  acceptPerIp: new RateLimiter({ limit: 60, windowMs: 15 * MINUTE }),
  /**
   * Per address: Steward ID callbacks. The start route costs nothing and any
   * page can link to it, so it is not limited; only completing a sign-in is.
   */
  ssoCallback: new RateLimiter({ limit: 50, windowMs: 15 * MINUTE }),
  /** Per address: requests that fail authentication or bring no credential. */
  tvUnauthenticated: new RateLimiter({ limit: 1000, windowMs: 15 * MINUTE }),
};
