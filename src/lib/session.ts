import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

const COOKIE = "tt_session";
const SESSION_DAYS = 30;

// `Secure` nur, wenn die App tatsächlich über HTTPS ausgeliefert wird. Diese App
// ist für den internen Betrieb über HTTP gedacht — würde das Cookie hier (wie bei
// NODE_ENV=production üblich) immer `Secure` sein, verwürfe der Browser es über
// http://<host>:3000 und man fliegt bei jedem Request zurück zum Login.
const SECURE_COOKIE = (process.env.APP_URL ?? "").startsWith("https://");

export type SessionWithUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Neue Session anlegen, Cookie setzen. pending2fa=true für den TOTP-Zwischenschritt. */
export async function createSession(userId: string, pending2fa = false): Promise<void> {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, tokenHash, pending2fa, expiresAt },
  });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    path: "/",
    expires: expiresAt,
  });
}

/** Session inkl. User lesen (auch pending2fa-Sessions). */
export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

/** pending2fa-Flag nach erfolgreichem TOTP-Schritt entfernen. */
export async function clearPending2fa(sessionId: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { pending2fa: false } });
}

/** Aktuelle Session beenden (Logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(COOKIE);
}
