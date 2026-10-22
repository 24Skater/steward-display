import type { Email } from "./mailer";

/**
 * The emails Display sends. Plain text first; the HTML is the same words with
 * one button, and every value in it is escaped.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(
  paragraphs: string[],
  action: { label: string; url: string },
  footer: string,
): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#FAF7F2;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0D1B2E">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="margin:0 0 24px;font-weight:600">Steward &middot; Display</p>
${body}
<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#E8B847;color:#1B2A41;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#57647A">Or paste this address into your browser:<br>${escapeHtml(action.url)}</p>
<p style="margin:24px 0 0;font-size:13px;color:#57647A">${escapeHtml(footer)}</p>
</div></body></html>`;
}

export function invitationEmail(input: {
  to: string;
  churchName: string;
  inviterName: string;
  role: "OWNER" | "EDITOR";
  link: string;
}): Email {
  const what = input.role === "OWNER" ? "an owner" : "an editor";
  const lines = [
    `${input.inviterName} invited you to help run the screens at ${input.churchName} as ${what}.`,
    "Steward Display is where the church builds what its lobby and hallway TVs show.",
  ];
  const footer =
    "The invitation lasts seven days. If you weren't expecting it, you can ignore this email.";
  return {
    to: input.to,
    subject: `Join ${input.churchName} on Steward Display`,
    text: `${lines.join("\n\n")}\n\nAccept the invitation:\n${input.link}\n\n${footer}`,
    html: layout(lines, { label: "Accept invitation", url: input.link }, footer),
  };
}

export function passwordResetEmail(input: { to: string; churchName: string; link: string }): Email {
  const lines = [
    `Someone asked to reset the password for your Steward Display account at ${input.churchName}.`,
    "If it was you, choose a new password with the link below. It works once, for one hour.",
  ];
  const footer = "If you didn't ask for this, ignore this email; your password stays as it is.";
  return {
    to: input.to,
    subject: "Reset your Steward Display password",
    text: `${lines.join("\n\n")}\n\n${input.link}\n\n${footer}`,
    html: layout(lines, { label: "Choose a new password", url: input.link }, footer),
  };
}

export function verificationEmail(input: { to: string; churchName: string; link: string }): Email {
  const lines = [
    `Confirm that this is your email address for Steward Display at ${input.churchName}.`,
    "It tells your church's team that mail from Steward Display reaches you.",
  ];
  const footer = "The link lasts 24 hours. If you didn't create an account, ignore this email.";
  return {
    to: input.to,
    subject: "Confirm your email for Steward Display",
    text: `${lines.join("\n\n")}\n\n${input.link}\n\n${footer}`,
    html: layout(lines, { label: "Confirm email", url: input.link }, footer),
  };
}
