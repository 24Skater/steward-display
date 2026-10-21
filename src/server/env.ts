/**
 * The subset of the environment the server modules read.
 *
 * Narrower than NodeJS.ProcessEnv on purpose, so a test can pass a two-key
 * object without a cast. Same shape as the other Steward apps' EnvBag.
 */
export type EnvBag = Record<string, string | undefined>;

export function isProduction(env: EnvBag = process.env): boolean {
  return env.NODE_ENV === "production";
}
