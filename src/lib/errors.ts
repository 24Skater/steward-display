/** A message to show a person, from anything a server function threw. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong. Try again in a moment.";
}
