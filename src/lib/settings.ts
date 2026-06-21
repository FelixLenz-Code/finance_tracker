import "server-only";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const TD = "TWELVEDATA_API_KEY";
const OF = "OPENFIGI_API_KEY";

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

// --- Twelve Data ---
export const getTwelveDataKey = () => getSecret(TD, "TWELVEDATA_API_KEY");
export const setTwelveDataKey = (raw: string) => setSecret(TD, raw);
export const twelveDataKeySource = () => secretSource(TD, "TWELVEDATA_API_KEY");

// --- OpenFIGI (WKN-Auflösung) ---
export const getOpenFigiKey = () => getSecret(OF, "OPENFIGI_API_KEY");
export const setOpenFigiKey = (raw: string) => setSecret(OF, raw);
export const openFigiKeySource = () => secretSource(OF, "OPENFIGI_API_KEY");
