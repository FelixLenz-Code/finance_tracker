"use client";

import { useActionState } from "react";
import { Button, Input, Label, Badge, FormError } from "@/components/ui";
import type { SmtpStatus } from "@/lib/settings";
import type { SettingsState } from "./actions";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

export function SmtpSettings({
  status,
  saveAction,
  removeAction,
  testAction,
}: {
  status: SmtpStatus;
  saveAction: Action;
  removeAction: () => Promise<void>;
  testAction: Action;
}) {
  const [saveState, save, saving] = useActionState(saveAction, {} as SettingsState);
  const [testState, test, testing] = useActionState(testAction, {} as SettingsState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {status.configured ? (
          <>
            <Badge color="green">Konfiguriert</Badge>
            <span className="text-sm text-zinc-400">
              {status.host} · Quelle: {status.source === "db" ? "in der App gespeichert" : ".env / Umgebung"}
            </span>
          </>
        ) : (
          <Badge color="zinc">Nicht konfiguriert</Badge>
        )}
      </div>

      {saveState.notice && <p className="text-sm text-emerald-300">{saveState.notice}</p>}
      <FormError message={saveState.error} />

      <form action={save} className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="smtp-host">Host</Label>
            <Input id="smtp-host" name="host" defaultValue={status.host ?? ""} placeholder="smtp.example.com" autoComplete="off" />
          </div>
          <div className="w-24">
            <Label htmlFor="smtp-port">Port</Label>
            <Input id="smtp-port" name="port" defaultValue={status.port ?? "587"} placeholder="587" autoComplete="off" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="smtp-user">Benutzer</Label>
            <Input id="smtp-user" name="user" defaultValue={status.user ?? ""} placeholder="optional" autoComplete="off" />
          </div>
          <div className="min-w-56 flex-1">
            <Label htmlFor="smtp-pass">Passwort</Label>
            <Input
              id="smtp-pass"
              name="password"
              type="password"
              autoComplete="off"
              placeholder={status.hasPassword ? "•••••••• (zum Ersetzen neu eingeben)" : "optional"}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="smtp-from">Absender (From)</Label>
          <Input id="smtp-from" name="from" defaultValue={status.from ?? ""} placeholder="Trade Tracker <no-reply@example.com>" autoComplete="off" />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
      </form>

      {status.configured && (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action={test}>
              <Button type="submit" variant="secondary" disabled={testing}>
                {testing ? "Sende…" : "Test-E-Mail senden"}
              </Button>
            </form>
            <form
              action={removeAction}
              onSubmit={(e) => {
                if (!confirm("SMTP-Konfiguration wirklich entfernen?")) e.preventDefault();
              }}
            >
              <Button type="submit" variant="danger">Konfiguration entfernen</Button>
            </form>
          </div>
          {testState.notice && <p className="text-sm text-emerald-300">{testState.notice}</p>}
          <FormError message={testState.error} />
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Wird für E-Mail-Verifizierung, Passwort-Reset und Erinnerungen genutzt. Passwort wird
        verschlüsselt in der Datenbank gespeichert; gespeicherte Werte haben Vorrang vor <code>.env</code>.
        Port 465 nutzt automatisch TLS, sonst STARTTLS.
      </p>
    </div>
  );
}
