import "server-only";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const TD = "TWELVEDATA_API_KEY";
const OF = "OPENFIGI_API_KEY";
const BK_CONF = "BACKUP_RCLONE_CONF";
const BK_DEST = "BACKUP_DEST";
const BK_TOKEN = "BACKUP_CRON_TOKEN";
const BK_LAST = "BACKUP_LAST_RESULT";
const SMTP_HOST = "SMTP_HOST";
const SMTP_PORT = "SMTP_PORT";
const SMTP_USER = "SMTP_USER";
const SMTP_PASS = "SMTP_PASSWORD";
const SMTP_FROM = "SMTP_FROM";
const RM_DAYS = "REMINDER_DAYS";
const RM_TOKEN = "REMINDER_CRON_TOKEN";
const REG_ENABLED = "REGISTRATION_ENABLED";
const VAPID_PUB = "VAPID_PUBLIC_KEY";
const VAPID_PRIV = "VAPID_PRIVATE_KEY";
const VAPID_SUBJECT = "VAPID_SUBJECT";

/** Secret: zuerst aus der DB (verschlüsselt), sonst aus der Umgebung. */
async function getSecret(key: string, envName: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.value) {
    try {
      return decryptSecret(row.value);
    } catch {
      return null;
    }
  }
  return process.env[envName] || null;
}

/** Secret setzen (verschlüsselt) oder bei leerem Wert entfernen. */
async function setSecret(key: string, raw: string): Promise<void> {
  const trimmed = raw.trim();
  if (!trimmed) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  const value = encryptSecret(trimmed);
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Woher kommt der aktive Key? Für die Status-Anzeige in den Einstellungen. */
async function secretSource(key: string, envName: string): Promise<"db" | "env" | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.value) return "db";
  if (process.env[envName]) return "env";
  return null;
}

/** Nicht-geheime Settings (unverschlüsselt gespeichert). */
async function getPlain(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}
async function setPlain(key: string, raw: string): Promise<void> {
  const v = raw.trim();
  if (!v) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.appSetting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
}

/** Nicht-geheimes Setting aus der DB, sonst aus der Umgebung. */
async function getPlainOrEnv(key: string, envName: string): Promise<string | null> {
  const v = await getPlain(key);
  if (v) return v;
  return process.env[envName] || null;
}

// --- Twelve Data ---
export const getTwelveDataKey = () => getSecret(TD, "TWELVEDATA_API_KEY");
export const setTwelveDataKey = (raw: string) => setSecret(TD, raw);
export const twelveDataKeySource = () => secretSource(TD, "TWELVEDATA_API_KEY");

// --- OpenFIGI (WKN-Auflösung) ---
export const getOpenFigiKey = () => getSecret(OF, "OPENFIGI_API_KEY");
export const setOpenFigiKey = (raw: string) => setSecret(OF, raw);
export const openFigiKeySource = () => secretSource(OF, "OPENFIGI_API_KEY");

// --- Offsite-Backup (rclone) ---
export const getBackupRcloneConf = () => getSecret(BK_CONF, "BACKUP_RCLONE_CONF");
export const setBackupRcloneConf = (raw: string) => setSecret(BK_CONF, raw);
export const getBackupDest = () => getPlain(BK_DEST);
export const setBackupDest = (raw: string) => setPlain(BK_DEST, raw);
export const getBackupToken = () => getSecret(BK_TOKEN, "BACKUP_CRON_TOKEN");
export const setBackupToken = (raw: string) => setSecret(BK_TOKEN, raw);
export const setBackupLast = (raw: string) => setPlain(BK_LAST, raw);

export type BackupStatus = {
  confSet: boolean;
  dest: string | null;
  hasToken: boolean;
  last: { ok: boolean; message: string; at: string; file?: string; bytes?: number } | null;
};

/** Status der Backup-Konfiguration für die Admin-Anzeige. */
export async function backupStatus(): Promise<BackupStatus> {
  const [confRow, dest, tokenRow, last] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: BK_CONF } }),
    getPlain(BK_DEST),
    prisma.appSetting.findUnique({ where: { key: BK_TOKEN } }),
    getPlain(BK_LAST),
  ]);
  let parsed: BackupStatus["last"] = null;
  if (last) {
    try {
      parsed = JSON.parse(last);
    } catch {
      parsed = null;
    }
  }
  return {
    confSet: Boolean(confRow?.value) || Boolean(process.env.BACKUP_RCLONE_CONF),
    dest,
    hasToken: Boolean(tokenRow?.value) || Boolean(process.env.BACKUP_CRON_TOKEN),
    last: parsed,
  };
}

// --- E-Mail (SMTP) ---
export type SmtpConfig = {
  host: string | null;
  port: string | null;
  user: string | null;
  password: string | null;
  from: string | null;
};

/** Effektive SMTP-Konfiguration (DB hat Vorrang, sonst ENV). */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  const [host, port, user, from, password] = await Promise.all([
    getPlainOrEnv(SMTP_HOST, "SMTP_HOST"),
    getPlainOrEnv(SMTP_PORT, "SMTP_PORT"),
    getPlainOrEnv(SMTP_USER, "SMTP_USER"),
    getPlainOrEnv(SMTP_FROM, "SMTP_FROM"),
    getSecret(SMTP_PASS, "SMTP_PASSWORD"),
  ]);
  return { host, port, user, password, from };
}

export const setSmtpHost = (raw: string) => setPlain(SMTP_HOST, raw);
export const setSmtpPort = (raw: string) => setPlain(SMTP_PORT, raw);
export const setSmtpUser = (raw: string) => setPlain(SMTP_USER, raw);
export const setSmtpFrom = (raw: string) => setPlain(SMTP_FROM, raw);
export const setSmtpPassword = (raw: string) => setSecret(SMTP_PASS, raw);

export async function clearSmtpConfig(): Promise<void> {
  await prisma.appSetting.deleteMany({
    where: { key: { in: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_PASS] } },
  });
}

export type SmtpStatus = {
  configured: boolean;
  host: string | null;
  port: string | null;
  user: string | null;
  from: string | null;
  hasPassword: boolean;
  source: "db" | "env" | null;
};

// --- Eingebauter Tages-Scheduler (Lauf-Tracking pro Job) ---
export const getJobLastRun = (job: string) => getPlain(`SCHED_LAST_${job}`);
export const setJobLastRun = (job: string, day: string) => setPlain(`SCHED_LAST_${job}`, day);

// --- Optionsablauf-Erinnerungen ---
export const REMINDER_DEFAULT_DAYS = 7;
export async function getReminderDays(): Promise<number> {
  const v = Number(await getPlainOrEnv(RM_DAYS, "REMINDER_DAYS"));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : REMINDER_DEFAULT_DAYS;
}
export const setReminderDays = (raw: string) => setPlain(RM_DAYS, raw);
export const getReminderToken = () => getSecret(RM_TOKEN, "REMINDER_CRON_TOKEN");
export const setReminderToken = (raw: string) => setSecret(RM_TOKEN, raw);

export async function reminderStatus(): Promise<{ days: number; hasToken: boolean }> {
  const [days, tokenRow] = await Promise.all([
    getReminderDays(),
    prisma.appSetting.findUnique({ where: { key: RM_TOKEN } }),
  ]);
  return { days, hasToken: Boolean(tokenRow?.value) || Boolean(process.env.REMINDER_CRON_TOKEN) };
}

// --- Selbst-Registrierung ---
/** Dürfen sich neue Nutzer selbst registrieren? Standard: ja. */
export async function isRegistrationEnabled(): Promise<boolean> {
  return (await getPlain(REG_ENABLED)) !== "off";
}
/** Selbst-Registrierung aktivieren/deaktivieren (nur Admin). */
export async function setRegistrationEnabled(enabled: boolean): Promise<void> {
  // "" löscht den Schlüssel → Standard (aktiviert); "off" deaktiviert.
  await setPlain(REG_ENABLED, enabled ? "" : "off");
}

// --- Web-Push (VAPID) ---
/** Gespeichertes VAPID-Schlüsselpaar (öffentlich plain, privat verschlüsselt). */
export async function getStoredVapidKeys(): Promise<{ publicKey: string | null; privateKey: string | null }> {
  const [publicKey, privateKey] = await Promise.all([
    getPlainOrEnv(VAPID_PUB, "VAPID_PUBLIC_KEY"),
    getSecret(VAPID_PRIV, "VAPID_PRIVATE_KEY"),
  ]);
  return { publicKey, privateKey };
}
export async function setVapidKeys(publicKey: string, privateKey: string): Promise<void> {
  await setPlain(VAPID_PUB, publicKey);
  await setSecret(VAPID_PRIV, privateKey);
}
/** VAPID-Subject (mailto:/https:) für Web-Push; aus Setting/ENV oder SMTP-Absender. */
export async function getVapidSubject(): Promise<string> {
  const explicit = await getPlainOrEnv(VAPID_SUBJECT, "VAPID_SUBJECT");
  if (explicit) return explicit;
  const from = await getPlainOrEnv(SMTP_FROM, "SMTP_FROM");
  const match = from?.match(/[^<>\s@]+@[^<>\s@]+/);
  return match ? `mailto:${match[0]}` : "mailto:admin@trade-tracker.local";
}
export async function vapidConfigured(): Promise<boolean> {
  const { publicKey, privateKey } = await getStoredVapidKeys();
  return Boolean(publicKey && privateKey);
}

export async function smtpStatus(): Promise<SmtpStatus> {
  const cfg = await getSmtpConfig();
  const [dbHost, pwRow] = await Promise.all([
    getPlain(SMTP_HOST),
    prisma.appSetting.findUnique({ where: { key: SMTP_PASS } }),
  ]);
  const source: "db" | "env" | null = dbHost ? "db" : process.env.SMTP_HOST ? "env" : null;
  return {
    configured: Boolean(cfg.host),
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    from: cfg.from,
    hasPassword: Boolean(pwRow?.value) || Boolean(process.env.SMTP_PASSWORD),
    source,
  };
}
