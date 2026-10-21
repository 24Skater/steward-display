import { newPairingCode, safeEqual } from "./secrets";

/**
 * The code that proves whoever is on the setup page also runs the server.
 *
 * A fresh install answers anyone who finds it, and the first person to finish
 * setup becomes the church's owner. So setup asks for a code that only appears
 * in the server's log (or that the operator chose in SETUP_CODE). A scanner, or
 * a web page using DNS rebinding against a LAN install, does not have it.
 */
let generated: string | null = null;
let announced = false;

export function setupCode(): string {
  const chosen = process.env.SETUP_CODE?.trim();
  if (chosen) return chosen;
  generated ??= newPairingCode() + newPairingCode();
  return generated;
}

/** Logs the code once, the first time someone reaches an unset-up install. */
export function announceSetupCode(): void {
  if (announced) return;
  announced = true;
  if (process.env.SETUP_CODE?.trim()) {
    console.log("[setup] Display is not set up yet. Open /setup and enter your SETUP_CODE.");
  } else {
    console.log(
      `[setup] Display is not set up yet. Open /setup and enter this code: ${setupCode()}`,
    );
  }
}

export function isSetupCode(input: unknown): boolean {
  return (
    typeof input === "string" && safeEqual(input.trim().toUpperCase(), setupCode().toUpperCase())
  );
}
