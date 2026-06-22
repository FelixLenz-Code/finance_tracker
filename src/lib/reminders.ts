import "server-only";
import { prisma } from "@/lib/db";
import { sendMail, mailConfigured } from "@/lib/mail";
import { fmtDate, toNum } from "@/lib/format";

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
  const rows = opts
    .map((p) => {
      const dir = p.direction === "SHORT" ? "Short" : "Long";
      const strike = p.strike != null ? toNum(p.strike) : "";
      return `<tr><td>${p.instrument.symbol}</td><td>${dir} ${p.optionRight ?? ""} ${strike}</td><td>${fmtDate(p.expiry!.toISOString())}</td><td>${p.account.name}</td></tr>`;
    })
    .join("");
  const html = `<p>Folgende offene Optionen verfallen innerhalb von ${u.reminderDays} Tagen:</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <thead><tr><th>Symbol</th><th>Position</th><th>Verfall</th><th>Depot</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#666;font-size:12px">Automatische Erinnerung vom Trade Tracker. Frist/Uhrzeit unter Einstellungen anpassbar.</p>`;
  await sendMail(u.email, `Trade Tracker — ${opts.length} Option(en) verfallen bald`, html);
  return opts.length;
}

/** Sofort an ALLE Nutzer mit aktivierten Erinnerungen senden (manuell / Endpoint). */
export async function sendAllRemindersNow(): Promise<ReminderResult> {
  if (!(await mailConfigured())) {
    return { ok: false, message: "Kein SMTP konfiguriert.", users: 0, options: 0 };
  }
  const today = new Date().toISOString().slice(0, 10);
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
  const today = now.toISOString().slice(0, 10);
  const users = await prisma.user.findMany({
    where: { remindersEnabled: true, reminderHour: { lte: now.getHours() } },
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
