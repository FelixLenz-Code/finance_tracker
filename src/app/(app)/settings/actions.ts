"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { setTwelveDataKey, setOpenFigiKey } from "@/lib/settings";
import { verifyPassword, hashPassword } from "@/lib/password";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
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
