import "server-only";
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const from = process.env.SMTP_FROM ?? "Trade Tracker <no-reply@example.com>";

/** SMTP konfiguriert? Wenn nicht, läuft die App ohne echten Mailversand. */
export function mailEnabled(): boolean {
  return Boolean(host);
}

function transport() {
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!mailEnabled()) {
    // Dev-Fallback: Link in die Server-Logs schreiben statt Mailversand.
    console.info(`[mail:disabled] An ${to} | ${subject}\n${html}`);
    return;
  }
  await transport().sendMail({ from, to, subject, html });
}
