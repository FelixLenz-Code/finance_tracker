import "server-only";
import type { TokenPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

/** Token erzeugen, Hash speichern, Klartext-Token zurückgeben (für den Mail-Link). */
export async function createToken(
  identifier: string,
  purpose: TokenPurpose,
  ttlMinutes: number,
): Promise<string> {
  const token = randomToken();
  await prisma.verificationToken.create({
    data: {
      identifier,
      tokenHash: sha256(token),
      purpose,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
  return token;
}

/** Token einlösen: gibt identifier (E-Mail) zurück oder null. Verbraucht das Token. */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!row || row.purpose !== purpose) return null;
  await prisma.verificationToken.delete({ where: { id: row.id } }).catch(() => {});
  if (row.expiresAt < new Date()) return null;
  return row.identifier;
}
