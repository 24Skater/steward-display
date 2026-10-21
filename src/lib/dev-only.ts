/**
 * Guards developer-only server functions (the brand contrast audit reads source files from
 * disk). In a production build they would be unauthenticated endpoints reading the filesystem.
 */
export function assertDevOnly(): void {
  if (!import.meta.env.DEV) {
    throw new Error("This developer tool is only available in development builds.");
  }
}
