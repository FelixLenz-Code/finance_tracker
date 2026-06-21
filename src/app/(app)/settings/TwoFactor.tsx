"use client";

import Image from "next/image";
import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, FormError, Badge } from "@/components/ui";
import {
  beginTotpEnroll,
  confirmTotpEnroll,
  disableTotp,
  type SettingsState,
} from "./actions";

export function TwoFactor({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [enroll, setEnroll] = useState<SettingsState>({});
  const [pending, start] = useTransition();
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmTotpEnroll,
    {} as SettingsState,
  );
  const [disableState, disableAction, disablePending] = useActionState(
    disableTotp,
    {} as SettingsState,
  );

  if (enabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge color="green">Aktiv</Badge>
          <span className="text-sm text-zinc-400">
            Zwei-Faktor-Authentifizierung ist eingeschaltet.
          </span>
        </div>
        {disableState.notice ? (
          <p className="text-sm text-emerald-300">{disableState.notice}</p>
        ) : (
          <form action={disableAction} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="password">Passwort zum Deaktivieren</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" variant="danger" disabled={disablePending}>
              Deaktivieren
            </Button>
          </form>
        )}
        <FormError message={disableState.error} />
      </div>
    );
  }

  // Backup-Codes nach erfolgreicher Aktivierung
  if (confirmState.codes) {
    return (
      <div className="space-y-3">
        <Badge color="green">Aktiviert</Badge>
        <p className="text-sm text-amber-300">
          Bewahre diese Backup-Codes sicher auf — jeder ist einmalig nutzbar:
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm">
          {confirmState.codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button onClick={() => router.refresh()}>Fertig</Button>
      </div>
    );
  }

  // Einrichtung gestartet → QR anzeigen + Code bestätigen
  if (enroll.qr) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Scanne den QR-Code mit deiner Authenticator-App und gib dann einen Code ein.
        </p>
        <Image
          src={enroll.qr}
          alt="TOTP QR-Code"
          width={180}
          height={180}
          unoptimized
          className="rounded-md bg-white p-2"
        />
        {enroll.notice && (
          <p className="text-xs text-zinc-500">
            Manuell: <span className="font-mono">{enroll.notice}</span>
          </p>
        )}
        <form action={confirmAction} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="code">Code aus der App</Label>
            <Input id="code" name="code" inputMode="numeric" required />
          </div>
          <Button type="submit" disabled={confirmPending}>
            Bestätigen
          </Button>
        </form>
        <FormError message={confirmState.error} />
      </div>
    );
  }

  // Startzustand
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge color="zinc">Inaktiv</Badge>
        <span className="text-sm text-zinc-400">
          Optional: zusätzliche Sicherheit per Authenticator-App.
        </span>
      </div>
      <Button
        onClick={() => start(async () => setEnroll(await beginTotpEnroll()))}
        disabled={pending}
      >
        {pending ? "Starte…" : "2FA einrichten"}
      </Button>
      <FormError message={enroll.error} />
    </div>
  );
}
