import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_FAILED = 8;

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** true, wenn für E-Mail ODER IP in den letzten WINDOW_MINUTES zu viele Fehlversuche. */
export async function isLoginBlocked(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const failed = await prisma.loginAttempt.count({
    where: {
      success: false,
      createdAt: { gte: since },
      OR: [{ email }, { ip }],
    },
  });
  return failed >= MAX_FAILED;
}

export async function recordLoginAttempt(
  email: string,
  ip: string,
  success: boolean,
): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip, success } });
  if (success) {
    // erfolgreiche Anmeldung setzt das Fehlversuch-Fenster zurück
    await prisma.loginAttempt.deleteMany({ where: { email, success: false } });
  }
}
