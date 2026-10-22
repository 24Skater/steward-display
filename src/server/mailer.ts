import nodemailer, { type Transporter } from "nodemailer";

import type { EnvBag } from "./env";

/**
 * Outgoing email, if this installation has any.
 *
 * Same variable names as Steward VBS, so a church configures every Steward app
 * the same way. Email is optional: without it, invitations hand the owner a
 * link to pass on, and password resets are done by whoever runs the server.
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendResult = { sent: true } | { sent: false; reason: "not-configured" | "failed" };

export function isEmailConfigured(env: EnvBag = process.env): boolean {
  return Boolean(env.EMAIL_SERVER_HOST?.trim() && env.EMAIL_FROM?.trim());
}

let transporter: Transporter | null = null;

function transport(env: EnvBag): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.EMAIL_SERVER_HOST,
    port: Number(env.EMAIL_SERVER_PORT ?? 587),
    secure: Number(env.EMAIL_SERVER_PORT ?? 587) === 465,
    // Nodemailer waits minutes by default; an owner should not stare at
    // "Inviting..." that long because a mail server is down.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: env.EMAIL_SERVER_USER
      ? { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD }
      : undefined,
  });
  return transporter;
}

/** Sends `email`. Never throws: a mail server being down must not fail the action around it. */
export async function sendEmail(email: Email, env: EnvBag = process.env): Promise<SendResult> {
  if (!isEmailConfigured(env)) return { sent: false, reason: "not-configured" };
  try {
    await transport(env).sendMail({ from: env.EMAIL_FROM, ...email });
    return { sent: true };
  } catch (error) {
    // The address and the error, never the body: bodies carry single-use links.
    console.error(`[email] Sending "${email.subject}" to ${email.to} failed:`, error);
    return { sent: false, reason: "failed" };
  }
}
