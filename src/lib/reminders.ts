import "server-only";
import { prisma } from "@/lib/db";
import { sendMail, mailConfigured } from "@/lib/mail";
import { renderEmail, emailParagraph, escapeHtml } from "@/lib/email";
import { fmtDate, toNum } from "@/lib/format";
import { zonedHour, zonedDateKey } from "@/lib/time";

export type ReminderResult = { ok: boolean; message: string; users: number; options: number };

type ReminderUser = { id: string; email: string; reminderDays: number };

/** Offene, bald (innerhalb `days`) verfallende Optionen eines Nutzers. */
async function expiringForUser(userId: string, days: number) {
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

/** Erinnerungs-Mail für einen Nutzer senden (nichts, wenn keine fällige Option). Gibt Anzahl Optionen zurück. */
async function sendForUser(u: ReminderUser): Promise<number> {
  const opts = await expiringForUser(u.id, u.reminderDays);
  if (opts.length === 0) return 0;
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
  return opts.length;
}

/** Sofort an ALLE Nutzer mit aktivierten Erinnerungen senden (manuell / Endpoint). */
export async function sendAllRemindersNow(): Promise<ReminderResult> {
  if (!(await mailConfigured())) {
    return { ok: false, message: "Kein SMTP konfiguriert.", users: 0, options: 0 };
  }
  const today = zonedDateKey();
  const users = await prisma.user.findMany({
    where: { remindersEnabled: true },
    select: { id: true, email: true, reminderDays: true },
  });
  let usersSent = 0;
  let options = 0;
  for (const u of users) {
    const n = await sendForUser(u);
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
  if (!(await mailConfigured())) return 0;
  const today = zonedDateKey(now);
  const users = await prisma.user.findMany({
    where: { remindersEnabled: true, reminderHour: { lte: zonedHour(now) } },
    select: { id: true, email: true, reminderDays: true, reminderLastSent: true },
  });
  let sent = 0;
  for (const u of users) {
    if (u.reminderLastSent === today) continue;
    await sendForUser(u);
    await prisma.user.update({ where: { id: u.id }, data: { reminderLastSent: today } });
    sent++;
  }
  return sent;
}
