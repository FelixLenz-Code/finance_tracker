import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendMail, mailConfigured } from "@/lib/mail";
import { sendPushToUser } from "@/lib/push";
import { renderEmail, emailParagraph, escapeHtml } from "@/lib/email";
import { fmtDate, toNum } from "@/lib/format";
import { zonedHour, zonedDateKey } from "@/lib/time";

export type ReminderResult = { ok: boolean; message: string; users: number; options: number };

type ReminderUser = {
  id: string;
  email: string;
  reminderDays: number;
  remindersEnabled: boolean;
  pushEnabled: boolean;
};

type ExpiringOption = {
  optionRight: string | null;
  strike: Prisma.Decimal | null;
  direction: string;
  expiry: Date | null;
  instrument: { symbol: string };
  account: { name: string };
};

/** Offene, bald (innerhalb `days`) verfallende Optionen eines Nutzers. */
async function expiringForUser(userId: string, days: number): Promise<ExpiringOption[]> {
  const horizon = new Date(Date.now() + days * 86400000);
  return prisma.position.findMany({
    where: { status: "OPEN", kind: "OPTION", expiry: { not: null, lte: horizon }, account: { userId } },
    select: {
      optionRight: true,
      strike: true,
      direction: true,
      expiry: true,
      instrument: { select: { symbol: true } },
      account: { select: { name: true } },
    },
    orderBy: { expiry: "asc" },
  });
}

/** Kurz-Beschreibung einer Position für Push-Text ("AAPL Short Put 150"). */
function posLabel(p: ExpiringOption): string {
  const dir = p.direction === "SHORT" ? "Short" : "Long";
  const strike = p.strike != null ? toNum(p.strike) : "";
  return `${p.instrument.symbol} ${dir} ${p.optionRight ?? ""} ${strike}`.replace(/\s+/g, " ").trim();
}

/** Erinnerungs-E-Mail für einen Nutzer bauen und senden. */
async function sendReminderEmail(u: ReminderUser, opts: ExpiringOption[]): Promise<void> {
  const td = "padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.06);font:400 14px -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e4e4e7;";
  const th = "padding:9px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.12);font:600 12px -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.4px;";
  const rows = opts
    .map((p) => {
      const dir = p.direction === "SHORT" ? "Short" : "Long";
      const strike = p.strike != null ? toNum(p.strike) : "";
      const pos = escapeHtml(`${dir} ${p.optionRight ?? ""} ${strike}`.trim());
      return `<tr>
        <td style="${td}font-weight:600;">${escapeHtml(p.instrument.symbol)}</td>
        <td style="${td}">${pos}</td>
        <td style="${td}color:#fca5a5;white-space:nowrap;">${escapeHtml(fmtDate(p.expiry!.toISOString()))}</td>
        <td style="${td}color:#a1a1aa;">${escapeHtml(p.account.name)}</td>
      </tr>`;
    })
    .join("");
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">
      <thead><tr><th style="${th}">Symbol</th><th style="${th}">Position</th><th style="${th}">Verfall</th><th style="${th}">Depot</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  const html = renderEmail({
    heading: `${opts.length} Option(en) verfallen bald`,
    preheader: `Innerhalb der nächsten ${u.reminderDays} Tage verfallen ${opts.length} offene Option(en).`,
    bodyHtml:
      emailParagraph(`Folgende offene Optionen verfallen innerhalb von <b style="color:#f4f4f5;">${u.reminderDays} Tagen</b>:`) +
      table,
    footnote: "Frist und Uhrzeit der Erinnerung kannst du in den Einstellungen anpassen.",
  });
  await sendMail(u.email, `Trade Tracker — ${opts.length} Option(en) verfallen bald`, html);
}

/** Push-Benachrichtigung mit gleichem Inhalt wie die E-Mail (kompakt). */
async function sendReminderPush(u: ReminderUser, opts: ExpiringOption[]): Promise<void> {
  const lines = opts.slice(0, 6).map((p) => `${posLabel(p)} — ${fmtDate(p.expiry!.toISOString())}`);
  if (opts.length > 6) lines.push(`… und ${opts.length - 6} weitere`);
  await sendPushToUser(u.id, {
    title: `${opts.length} Option(en) verfallen bald`,
    body: lines.join("\n"),
    url: "/overview",
  });
}

/**
 * Erinnerung über alle aktiven Kanäle eines Nutzers senden (E-Mail und/oder Push).
 * Gibt die Anzahl fälliger Optionen zurück (0 = nichts gesendet).
 */
async function sendForUser(u: ReminderUser, mailOk: boolean): Promise<number> {
  const opts = await expiringForUser(u.id, u.reminderDays);
  if (opts.length === 0) return 0;
  if (u.remindersEnabled && mailOk) await sendReminderEmail(u, opts);
  if (u.pushEnabled) await sendReminderPush(u, opts);
  return opts.length;
}

const USER_SELECT = {
  id: true,
  email: true,
  reminderDays: true,
  remindersEnabled: true,
  pushEnabled: true,
} as const;

/** Sofort an ALLE Nutzer mit aktiviertem Kanal senden (manuell / Endpoint). */
export async function sendAllRemindersNow(): Promise<ReminderResult> {
  const mailOk = await mailConfigured();
  const users = await prisma.user.findMany({
    where: { OR: [{ remindersEnabled: true }, { pushEnabled: true }] },
    select: USER_SELECT,
  });
  if (users.length === 0) {
    return { ok: true, message: "Keine Nutzer mit aktivierten Erinnerungen.", users: 0, options: 0 };
  }
  const today = zonedDateKey();
  let usersSent = 0;
  let options = 0;
  for (const u of users) {
    const n = await sendForUser(u, mailOk);
    if (n > 0) {
      usersSent++;
      options += n;
    }
    await prisma.user.update({ where: { id: u.id }, data: { reminderLastSent: today } });
  }
  return { ok: true, message: `${usersSent} Nutzer benachrichtigt (${options} Optionen).`, users: usersSent, options };
}

/**
 * Scheduler-Pfad: an Nutzer senden, deren persönliche Uhrzeit erreicht ist und die heute noch
 * keine Erinnerung erhalten haben. Gibt Anzahl benachrichtigter Nutzer zurück.
 */
export async function runDueReminders(now: Date): Promise<number> {
  const mailOk = await mailConfigured();
  const today = zonedDateKey(now);
  const users = await prisma.user.findMany({
    where: {
      OR: [{ remindersEnabled: true }, { pushEnabled: true }],
      reminderHour: { lte: zonedHour(now) },
    },
    select: { ...USER_SELECT, reminderLastSent: true },
  });
  let sent = 0;
  for (const u of users) {
    if (u.reminderLastSent === today) continue;
    await sendForUser(u, mailOk);
    await prisma.user.update({ where: { id: u.id }, data: { reminderLastSent: today } });
    sent++;
  }
  return sent;
}
