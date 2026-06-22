import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/lib/settings";

const DEFAULT_FROM = "Trade Tracker <no-reply@example.com>";

/** SMTP konfiguriert? (DB oder ENV). Wenn nicht, läuft die App ohne echten Mailversand. */
export async function mailConfigured(): Promise<boolean> {
  return Boolean((await getSmtpConfig()).host);
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const cfg = await getSmtpConfig();
  if (!cfg.host) {
    // Dev-Fallback: Inhalt in die Server-Logs schreiben statt Mailversand.
    console.info(`[mail:disabled] An ${to} | ${subject}\n${html}`);
    return;
  }
  const port = Number(cfg.port ?? 587);
  await nodemailer
    .createTransport({
      host: cfg.host,
      port,
      secure: port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.password ?? "" } : undefined,
    })
    .sendMail({ from: cfg.from ?? DEFAULT_FROM, to, subject, html });
}
