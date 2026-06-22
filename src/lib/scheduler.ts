import "server-only";
import {
  getJobLastRun,
  setJobLastRun,
  getBackupRcloneConf,
  getBackupDest,
} from "@/lib/settings";
import { runDueReminders } from "@/lib/reminders";
import { runBackup } from "@/lib/backup";

const TICK_MS = 10 * 60 * 1000; // alle 10 Minuten prüfen

type G = typeof globalThis & { __ttSchedulerStarted?: boolean };

/**
 * Startet den eingebauten Tages-Scheduler (einmal pro Prozess). Verschickt
 * Erinnerungen je Nutzer zur eigenen Uhrzeit und erstellt das Backup einmal
 * täglich — automatisch, sobald E-Mail bzw. Backup eingerichtet sind. Kein
 * externer Cron/Token nötig.
 */
export function startScheduler() {
  const g = globalThis as G;
  if (g.__ttSchedulerStarted) return;
  g.__ttSchedulerStarted = true;

  const timer = setInterval(() => void tick(), TICK_MS);
  // Prozess nicht am Beenden hindern.
  if (typeof timer.unref === "function") timer.unref();
  void tick();
  console.info("[scheduler] gestartet");
}

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Erinnerungen: pro Nutzer zur jeweils eigenen Uhrzeit/Frist.
    const sent = await runDueReminders(now);
    if (sent) console.info(`[scheduler] Erinnerungen an ${sent} Nutzer gesendet`);

    // Backup: einmal täglich (erste Gelegenheit), sobald rclone eingerichtet ist.
    const [conf, dest] = await Promise.all([getBackupRcloneConf(), getBackupDest()]);
    if ((await getJobLastRun("backup")) !== today && conf && dest) {
      await setJobLastRun("backup", today);
      const res = await runBackup();
      console.info(`[scheduler] Backup: ${res.message}`);
    }
  } catch (e) {
    console.error("[scheduler] Fehler:", e);
  } finally {
    running = false;
  }
}
