"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import {
  setTwelveDataKey,
  setOpenFigiKey,
  setBackupRcloneConf,
  getBackupRcloneConf,
  setBackupDest,
  setBackupToken,
  setSmtpHost,
  setSmtpPort,
  setSmtpUser,
  setSmtpFrom,
  setSmtpPassword,
  clearSmtpConfig,
  setReminderToken,
  setRegistrationEnabled,
} from "@/lib/settings";
import { runBackup } from "@/lib/backup";
import { sendAllRemindersNow } from "@/lib/reminders";
import { sendMail } from "@/lib/mail";
import { verifyPassword, hashPassword } from "@/lib/password";
import { encryptSecret, decryptSecret, randomToken } from "@/lib/crypto";
import {
  generateTotpSecret,
  totpUri,
  verifyTotp,
  generateBackupCodes,
} from "@/lib/totp";

export type SettingsState = {
  error?: string;
  notice?: string;
  qr?: string; // Data-URL für QR-Code
  codes?: string[]; // Backup-Codes (nur einmalig nach Aktivierung)
  token?: string; // Cron-Token (nur einmalig nach Erzeugung sichtbar)
  conf?: string; // rclone-Config zum Download (nach Passwort-Abfrage)
};

/** Schritt 1: Secret erzeugen, verschlüsselt speichern (noch nicht aktiv), QR liefern. */
export async function beginTotpEnroll(): Promise<SettingsState> {
  const user = await requireUser();
  if (user.totpEnabled) return { error: "2FA ist bereits aktiv." };

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptSecret(secret), totpEnabled: false },
  });

  const uri = totpUri(secret, user.email);
  const qr = await QRCode.toDataURL(uri);
  return { qr, notice: secret }; // Secret im notice-Feld für manuelle Eingabe
}

/** Schritt 2: Code prüfen, 2FA aktivieren, Backup-Codes erzeugen. */
export async function confirmTotpEnroll(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  if (!user.totpSecret) return { error: "Bitte zuerst die Einrichtung starten." };

  const code = String(formData.get("code") ?? "").trim();
  if (!verifyTotp(decryptSecret(user.totpSecret), code)) {
    return { error: "Code ungültig — bitte erneut versuchen." };
  }

  const codes = generateBackupCodes(10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } }),
    prisma.backupCode.deleteMany({ where: { userId: user.id } }),
    prisma.backupCode.createMany({
      data: await Promise.all(
        codes.map(async (c) => ({ userId: user.id, codeHash: await hashPassword(c) })),
      ),
    }),
  ]);

  return { codes, notice: "2FA ist aktiviert. Bewahre die Backup-Codes sicher auf." };
}

/** Twelve-Data-API-Key speichern/entfernen (nur Admin). */
export async function saveTwelveDataKey(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const key = String(formData.get("apiKey") ?? "");
  await setTwelveDataKey(key);
  revalidatePath("/settings");
  return { notice: key.trim() ? "API-Key gespeichert." : "API-Key entfernt." };
}

/** Twelve-Data-API-Key explizit entfernen (nur Admin). */
export async function removeTwelveDataKey(): Promise<void> {
  await requireRole("ADMIN");
  await setTwelveDataKey("");
  revalidatePath("/settings");
}

/** OpenFIGI-API-Key speichern/entfernen (nur Admin, optional für WKN-Limit). */
export async function saveOpenFigiKey(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const key = String(formData.get("apiKey") ?? "");
  await setOpenFigiKey(key);
  revalidatePath("/settings");
  return { notice: key.trim() ? "API-Key gespeichert." : "API-Key entfernt." };
}

/** OpenFIGI-API-Key explizit entfernen (nur Admin). */
export async function removeOpenFigiKey(): Promise<void> {
  await requireRole("ADMIN");
  await setOpenFigiKey("");
  revalidatePath("/settings");
}

/** Offsite-Backup konfigurieren (rclone-Config + Ziel-Remote, nur Admin). */
export async function saveBackupConfig(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const conf = String(formData.get("conf") ?? "");
  const dest = String(formData.get("dest") ?? "").trim();

  if (conf.trim() && !dest) {
    return { error: "Bitte auch ein Ziel angeben (z. B. crypt:tracker-backups)." };
  }
  await setBackupRcloneConf(conf);
  await setBackupDest(dest);
  revalidatePath("/settings");
  return { notice: conf.trim() ? "Backup-Konfiguration gespeichert." : "Backup-Konfiguration entfernt." };
}

/** Backup-Konfiguration vollständig entfernen (nur Admin). */
export async function removeBackupConfig(): Promise<void> {
  await requireRole("ADMIN");
  await setBackupRcloneConf("");
  await setBackupDest("");
  await setBackupToken("");
  revalidatePath("/settings");
}

/** Backup sofort ausführen (nur Admin). */
export async function runBackupNow(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const res = await runBackup();
  revalidatePath("/settings");
  return res.ok ? { notice: res.message } : { error: res.message };
}

/** rclone-Config zum Download liefern — nur nach erneuter Passwort-Eingabe (Admin). */
export async function downloadRcloneConf(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireRole("ADMIN");
  const password = String(formData.get("password") ?? "");
  if (!(await verifyPassword(user.passwordHash, password))) {
    return { error: "Passwort falsch." };
  }
  const conf = await getBackupRcloneConf();
  if (!conf) return { error: "Keine rclone-Konfiguration gespeichert." };
  return { conf };
}

/** Cron-Token für die Automatisierung neu erzeugen (nur Admin). */
export async function regenerateBackupToken(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const token = randomToken(24);
  await setBackupToken(token);
  revalidatePath("/settings");
  return { token, notice: "Neues Token erzeugt — jetzt kopieren, es wird nur einmal angezeigt." };
}

/** SMTP-Server konfigurieren (nur Admin). Passwort leer = unverändert lassen. */
export async function saveSmtpConfig(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const host = String(formData.get("host") ?? "");
  if (!host.trim()) return { error: "Host erforderlich (oder „Entfernen“ nutzen)." };

  await setSmtpHost(host);
  await setSmtpPort(String(formData.get("port") ?? ""));
  await setSmtpUser(String(formData.get("user") ?? ""));
  await setSmtpFrom(String(formData.get("from") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (password.trim()) await setSmtpPassword(password);

  revalidatePath("/settings");
  return { notice: "SMTP-Konfiguration gespeichert." };
}

/** SMTP-Konfiguration vollständig entfernen (nur Admin). */
export async function removeSmtpConfig(): Promise<void> {
  await requireRole("ADMIN");
  await clearSmtpConfig();
  revalidatePath("/settings");
}

/** Test-E-Mail an die eigene Adresse senden (nur Admin). */
export async function sendTestMail(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const user = await requireRole("ADMIN");
  try {
    await sendMail(
      user.email,
      "Trade Tracker — Test-E-Mail",
      "<p>Diese Test-E-Mail bestätigt, dass dein SMTP-Server korrekt konfiguriert ist. ✅</p>",
    );
  } catch (e) {
    return { error: `Versand fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannter Fehler"}.` };
  }
  return { notice: `Test-E-Mail an ${user.email} ausgelöst. Prüfe Posteingang/Logs.` };
}

/** Persönliche Erinnerungs-Einstellungen speichern (jeder Nutzer für sich). */
export async function saveReminderPrefs(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const clamp = (n: number, lo: number, hi: number, def: number) =>
    Number.isFinite(n) && n >= lo && n <= hi ? Math.floor(n) : def;
  const days = clamp(Number(formData.get("days")), 1, 90, 7);
  const hour = clamp(Number(formData.get("hour")), 0, 23, 9);
  await prisma.user.update({
    where: { id: user.id },
    data: { remindersEnabled: formData.get("enabled") != null, reminderDays: days, reminderHour: hour },
  });
  revalidatePath("/settings");
  return { notice: "Erinnerungs-Einstellungen gespeichert." };
}

/** Cron-Token für Erinnerungen neu erzeugen (nur Admin). */
export async function regenerateReminderToken(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const token = randomToken(24);
  await setReminderToken(token);
  revalidatePath("/settings");
  return { token, notice: "Neues Token erzeugt — jetzt kopieren, es wird nur einmal angezeigt." };
}

/** Erinnerungen sofort an alle aktivierten Nutzer senden (nur Admin). */
export async function runRemindersNow(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const res = await sendAllRemindersNow();
  return res.ok ? { notice: res.message } : { error: res.message };
}

/** Selbst-Registrierung neuer Nutzer aktivieren/deaktivieren (nur Admin). */
export async function setRegistration(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const enabled = formData.get("enabled") != null;
  await setRegistrationEnabled(enabled);
  revalidatePath("/settings");
  return {
    notice: enabled
      ? "Selbst-Registrierung aktiviert."
      : "Selbst-Registrierung deaktiviert.",
  };
}

/** 2FA deaktivieren — verlangt das aktuelle Passwort. */
export async function disableTotp(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");

  if (!(await verifyPassword(user.passwordHash, password))) {
    return { error: "Passwort falsch." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: false, totpSecret: null },
    }),
    prisma.backupCode.deleteMany({ where: { userId: user.id } }),
  ]);

  return { notice: "2FA wurde deaktiviert." };
}
