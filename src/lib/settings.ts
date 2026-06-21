import "server-only";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const TD_KEY = "TWELVEDATA_API_KEY";

/** Twelve-Data-Key: zuerst aus der DB (verschlüsselt), sonst aus der Umgebung. */
export async function getTwelveDataKey(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: TD_KEY } });
  if (row?.value) {
    try {
      return decryptSecret(row.value);
    } catch {
      return null;
    }
  }
  return process.env.TWELVEDATA_API_KEY || null;
}

/** Key setzen (verschlüsselt) oder bei leerem Wert entfernen. */
export async function setTwelveDataKey(raw: string): Promise<void> {
  const trimmed = raw.trim();
  if (!trimmed) {
    await prisma.appSetting.deleteMany({ where: { key: TD_KEY } });
    return;
  }
  const value = encryptSecret(trimmed);
  await prisma.appSetting.upsert({
    where: { key: TD_KEY },
    update: { value },
    create: { key: TD_KEY, value },
  });
}

/** Woher kommt der aktive Key? Für die Status-Anzeige in den Einstellungen. */
export async function twelveDataKeySource(): Promise<"db" | "env" | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: TD_KEY } });
  if (row?.value) return "db";
  if (process.env.TWELVEDATA_API_KEY) return "env";
  return null;
}
