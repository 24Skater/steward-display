import { ZodError } from "zod";

/**
 * An error whose message is written for the person who caused it, and is
 * therefore safe to show them. Anything else is logged and replaced with a
 * generic message, so a stack trace or a SQL fragment never reaches a browser.
 */
export class UserError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "UserError";
  }
}

/** The first validation problem, phrased for a person: "widgets.3.config.src: Must be ...". */
export function describeValidation(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "That was not valid.";
  const where = issue.path.join(".");
  return where ? `${where}: ${issue.message}` : issue.message;
}

/** A message safe to show the person, for any thrown value. */
export function publicMessage(error: unknown): string {
  if (error instanceof UserError) return error.message;
  if (error instanceof ZodError) return describeValidation(error);
  return "Something went wrong on our end. Try again in a moment.";
}

/** Normalises anything thrown in a request into an error safe to send to the browser. */
export function toUserError(error: unknown): UserError {
  if (error instanceof UserError) return error;
  if (error instanceof ZodError) return new UserError(describeValidation(error));
  console.error(error);
  return new UserError(publicMessage(error), 500);
}
