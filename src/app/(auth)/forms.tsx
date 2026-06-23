"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Input, Label, FieldError, FormError } from "@/components/ui";
import type { ActionState } from "./actions";
import {
  registerAction,
  loginAction,
  verifyTotpAction,
  requestResetAction,
  resetPasswordAction,
} from "./actions";

const initial: ActionState = {};

function Notice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
      {message}
    </div>
  );
}

/** Heuristische Passwort-Stärke (0–4) aus Länge und Zeichenvielfalt. */
function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const STRENGTH = [
  { label: "Sehr schwach", color: "bg-red-500", text: "text-red-400" },
  { label: "Schwach", color: "bg-red-500", text: "text-red-400" },
  { label: "Okay", color: "bg-amber-500", text: "text-amber-400" },
  { label: "Gut", color: "bg-emerald-500", text: "text-emerald-400" },
  { label: "Stark", color: "bg-emerald-400", text: "text-emerald-300" },
];

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score = passwordScore(value);
  const s = STRENGTH[score];
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < Math.max(score, 1) && score > 0 ? s.color : "bg-zinc-700"}`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs ${s.text}`}>Passwortstärke: {s.label}</p>
    </div>
  );
}

export function LoginForm({
  notice,
  registrationOpen = true,
}: {
  notice?: string;
  registrationOpen?: boolean;
}) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4">
      {notice === "verify" && <Notice message="Bitte bestätige zuerst deine E-Mail." />}
      {notice === "reset" && <Notice message="Passwort geändert. Bitte einloggen." />}
      {notice === "registration-off" && (
        <Notice message="Die Registrierung ist derzeit deaktiviert." />
      )}
      <FormError message={state.error} />
      <div>
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <div>
        <Label htmlFor="password">Passwort</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Anmelden…" : "Anmelden"}
      </Button>
      <div className="flex justify-between text-sm text-zinc-400">
        <Link href="/forgot-password" className="hover:text-zinc-200">Passwort vergessen?</Link>
        {registrationOpen && (
          <Link href="/register" className="hover:text-zinc-200">Konto erstellen</Link>
        )}
      </div>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  const [pw, setPw] = useState("");
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
        <FieldError message={state.fieldErrors?.name} />
      </div>
      <div>
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <div>
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <PasswordStrength value={pw} />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div>
        <Label htmlFor="confirm">Passwort wiederholen</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.confirm} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Erstellen…" : "Konto erstellen"}
      </Button>
      <p className="text-center text-sm text-zinc-400">
        Schon registriert?{" "}
        <Link href="/login" className="hover:text-zinc-200">Anmelden</Link>
      </p>
    </form>
  );
}

export function TotpForm() {
  const [state, action, pending] = useActionState(verifyTotpAction, initial);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <div>
        <Label htmlFor="code">6-stelliger Code (oder Backup-Code)</Label>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required />
        <FieldError message={state.fieldErrors?.code} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Prüfen…" : "Bestätigen"}
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestResetAction, initial);
  return (
    <form action={action} className="space-y-4">
      <Notice message={state.notice} />
      <FormError message={state.error} />
      <div>
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Senden…" : "Link senden"}
      </Button>
      <p className="text-center text-sm text-zinc-400">
        <Link href="/login" className="hover:text-zinc-200">Zurück zum Login</Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  const [pw, setPw] = useState("");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state.error} />
      <div>
        <Label htmlFor="password">Neues Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <PasswordStrength value={pw} />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div>
        <Label htmlFor="confirm">Wiederholen</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.confirm} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Speichern…" : "Passwort setzen"}
      </Button>
    </form>
  );
}
