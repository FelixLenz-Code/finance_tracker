import "server-only";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { getSession } from "@/lib/session";

/** Vollständig eingeloggter User (Session existiert und 2FA-Schritt abgeschlossen). */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session || session.pending2fa) return null;
  return session.user;
}

/** Erzwingt eingeloggten User, sonst Redirect zum Login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Erzwingt Admin-Rolle. */
export async function requireRole(role: Role): Promise<User> {
  const user = await requireUser();
  if (user.role !== role && user.role !== "ADMIN") redirect("/");
  return user;
}

export const requireAdmin = () => requireRole("ADMIN");
