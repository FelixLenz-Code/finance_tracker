"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, getSession, clearPending2fa, destroySession } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { isLoginBlocked, recordLoginAttempt, getClientIp, rateLimit } from "@/lib/ratelimit";
import { createToken, consumeToken } from "@/lib/tokens";
import { sendMail, mailConfigured } from "@/lib/mail";
import { renderEmail, emailParagraph, escapeHtml } from "@/lib/email";
import { isRegistrationEnabled } from "@/lib/settings";
import {
  registerSchema,
  loginSchema,
  totpSchema,
  requestResetSchema,
  resetPasswordSchema,
  formObject,
} from "@/lib/validation";
import { z } from "zod";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
};

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0]?.toString() ?? "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// ---------- Registrierung ----------

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: zodErrors(parsed.error) };
  const { name, email, password } = parsed.data;

  // Missbrauch/Mail-Bombing drosseln (Registrierung kann Verifizierungs-Mails auslösen).
  const regIp = await getClientIp();
  if (!rateLimit(`register:${regIp}`, 5, 15 * 60 * 1000)) {
    return { error: "Zu viele Versuche. Bitte in ein paar Minuten erneut versuchen." };
  }

  // Erster Nutzer wird Admin und ist automatisch verifiziert.
  const isFirst = (await prisma.user.count()) === 0;

  // Selbst-Registrierung kann vom Admin deaktiviert werden — der allererste
  // Nutzer (Bootstrap-Admin) darf sich aber immer anlegen.
  if (!isFirst && !(await isRegistrationEnabled())) {
    return { error: "Die Registrierung ist derzeit deaktiviert." };
  }

  const mailOn = await mailConfigured();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Keine Account-Enumeration: bei konfiguriertem Mailversand exakt dieselbe
    // Antwort wie eine verifizierungspflichtige Neuregistrierung liefern und den
    // bestehenden Inhaber per Mail informieren (statt die Existenz zu verraten).
    if (mailOn && !isFirst) {
      await sendMail(
        email,
        "Kontoerstellung",
        renderEmail({
          heading: "Konto bereits vorhanden",
          preheader: "Es wurde versucht, mit dieser E-Mail ein Konto zu erstellen.",
          bodyHtml:
            emailParagraph("Es wurde versucht, mit dieser E-Mail-Adresse ein Konto zu erstellen.") +
            emailParagraph("Du hast bereits ein Konto — bitte melde dich an oder setze bei Bedarf dein Passwort zurück. Falls du das nicht warst, kannst du diese Nachricht ignorieren."),
          button: { label: "Zur Anmeldung", url: `${APP_URL}/login` },
        }),
      ).catch(() => {});
      redirect("/login?notice=verify");
    }
    return { fieldErrors: { email: "E-Mail bereits registriert" } };
  }

  const requireVerification = mailOn && !isFirst;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: isFirst ? "ADMIN" : "USER",
      emailVerified: requireVerification ? null : new Date(),
    },
  });

  if (requireVerification) {
    const token = await createToken(email, "EMAIL_VERIFY", 60 * 24);
    const link = `${APP_URL}/verify-email?token=${token}`;
    await sendMail(
      email,
      "E-Mail bestätigen",
      renderEmail({
        heading: "E-Mail bestätigen",
        preheader: "Bestätige deine E-Mail-Adresse, um loszulegen.",
        bodyHtml:
          emailParagraph(`Hallo ${escapeHtml(name)}, willkommen beim Trade Tracker!`) +
          emailParagraph("Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:"),
        button: { label: "E-Mail bestätigen", url: link },
        footnote: `Funktioniert der Button nicht, öffne diesen Link: ${link} — er ist 24 Stunden gültig.`,
      }),
    );
    redirect("/login?notice=verify");
  }

  // Direkt einloggen.
  await createSession(user.id, false);
  redirect("/");
}

// ---------- Login (Schritt 1: Passwort) ----------

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: zodErrors(parsed.error) };
  const { email, password } = parsed.data;

  const ip = await getClientIp();
  if (await isLoginBlocked(email, ip)) {
    return { error: "Zu viele Fehlversuche. Bitte in ein paar Minuten erneut versuchen." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && (await verifyPassword(user.passwordHash, password));

  if (!user || !ok) {
    await recordLoginAttempt(email, ip, false);
    return { error: "E-Mail oder Passwort falsch" };
  }

  if (!user.emailVerified) {
    return { error: "Bitte zuerst die E-Mail bestätigen." };
  }

  await recordLoginAttempt(email, ip, true);

  if (user.totpEnabled) {
    await createSession(user.id, true); // pending 2FA
    redirect("/2fa");
  }

  await createSession(user.id, false);
  redirect("/");
}

// ---------- Login (Schritt 2: TOTP / Backup-Code) ----------

export async function verifyTotpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = totpSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: zodErrors(parsed.error) };

  const session = await getSession();
  if (!session || !session.pending2fa) redirect("/login");

  const user = session.user;
  if (!user.totpEnabled || !user.totpSecret) redirect("/login");

  // Brute-Force-Schutz auch für den 2FA-Schritt (nicht nur fürs Passwort).
  const ip = await getClientIp();
  if (await isLoginBlocked(user.email, ip)) {
    return { error: "Zu viele Fehlversuche. Bitte in ein paar Minuten erneut versuchen." };
  }

  const { decryptSecret } = await import("@/lib/crypto");
  const code = parsed.data.code.trim();

  let valid = verifyTotp(decryptSecret(user.totpSecret), code);

  // Alternativ: unbenutzten Backup-Code prüfen.
  if (!valid) {
    const codes = await prisma.backupCode.findMany({
      where: { userId: user.id, usedAt: null },
    });
    for (const bc of codes) {
      if (await verifyPassword(bc.codeHash, code)) {
        await prisma.backupCode.update({
          where: { id: bc.id },
          data: { usedAt: new Date() },
        });
        valid = true;
        break;
      }
    }
  }

  if (!valid) {
    await recordLoginAttempt(user.email, ip, false);
    return { error: "Code ungültig" };
  }

  await recordLoginAttempt(user.email, ip, true);
  await clearPending2fa(session.id);
  redirect("/");
}

// ---------- Logout ----------

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ---------- Passwort-Reset anfordern ----------

export async function requestResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestResetSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: zodErrors(parsed.error) };
  const { email } = parsed.data;

  // Mail-Bombing/Enumeration drosseln: pro IP und pro Zieladresse. Bei Überschreitung
  // dieselbe generische Antwort, ohne eine weitere Mail zu versenden.
  const ip = await getClientIp();
  const allowed =
    rateLimit(`reset-ip:${ip}`, 5, 15 * 60 * 1000) &&
    rateLimit(`reset-mail:${email}`, 3, 60 * 60 * 1000);

  const user = allowed ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user) {
    const token = await createToken(email, "PASSWORD_RESET", 60);
    const link = `${APP_URL}/reset-password?token=${token}`;
    await sendMail(
      email,
      "Passwort zurücksetzen",
      renderEmail({
        heading: "Passwort zurücksetzen",
        preheader: "Setze dein Passwort über den Link zurück.",
        bodyHtml:
          emailParagraph("Es wurde angefordert, dein Passwort zurückzusetzen. Klicke auf den Button, um ein neues Passwort zu vergeben:") +
          emailParagraph("Falls du das nicht warst, kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert."),
        button: { label: "Neues Passwort setzen", url: link },
        footnote: `Funktioniert der Button nicht, öffne diesen Link: ${link} — er ist 60 Minuten gültig.`,
      }),
    );
  }
  // Immer gleiche Antwort (keine Account-Enumeration).
  return { notice: "Falls die E-Mail existiert, wurde ein Link versendet." };
}

// ---------- Passwort zurücksetzen ----------

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: zodErrors(parsed.error) };

  const email = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!email) return { error: "Link ungültig oder abgelaufen." };

  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  // Alle bestehenden Sessions entwerten (sperrt evtl. Angreifer aus) und übrige
  // offene Reset-Tokens dieses Kontos invalidieren.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.verificationToken.deleteMany({
    where: { identifier: email, purpose: "PASSWORD_RESET" },
  });
  redirect("/login?notice=reset");
}
