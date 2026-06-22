"use client";

import { useActionState } from "react";
import { Button, Badge, FormError } from "@/components/ui";
import type { SettingsState } from "./actions";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

export function ReminderSettings({
  hasToken,
  smtpConfigured,
  tokenAction,
  runAction,
}: {
  hasToken: boolean;
  smtpConfigured: boolean;
  tokenAction: Action;
  runAction: Action;
}) {
  const [tokenState, genToken, genning] = useActionState(tokenAction, {} as SettingsState);
  const [runState, run, running] = useActionState(runAction, {} as SettingsState);

  return (
    <div className="space-y-4">
      {!smtpConfigured && (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
          Kein SMTP konfiguriert — Erinnerungen können erst nach Einrichtung des E-Mail-Servers versendet werden.
        </p>
      )}

      <p className="text-sm text-zinc-400">
        Frist (Tage) und Uhrzeit stellt <b>jede:r Nutzer:in selbst</b> unter „Erinnerungen" ein.
        Über die Automatik werden sie zur jeweiligen Uhrzeit automatisch verschickt.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <form action={run}>
          <Button type="submit" variant="secondary" disabled={running || !smtpConfigured}>
            {running ? "Sende…" : "Jetzt an alle senden"}
          </Button>
        </form>
        {runState.notice && <span className="text-sm text-emerald-300">{runState.notice}</span>}
        <FormError message={runState.error} />
      </div>

      <div className="space-y-2 border-t border-white/5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">Extern auslösen (optional)</span>
          {hasToken ? <Badge color="green">Token aktiv</Badge> : <Badge color="zinc">Kein Token</Badge>}
        </div>
        <p className="text-xs text-zinc-500">
          Nur nötig ohne die eingebaute Automatik (externer Scheduler):
        </p>
        <pre className="overflow-x-auto rounded-md border border-white/5 bg-zinc-950/60 p-2 text-xs text-zinc-300">
{`curl -X POST -H "Authorization: Bearer <TOKEN>" \\
  https://DEIN-HOST/api/reminders/run`}
        </pre>
        {tokenState.token && (
          <p className="break-all rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-200">
            Token: <code className="font-mono">{tokenState.token}</code>
          </p>
        )}
        <form action={genToken}>
          <Button type="submit" variant="secondary" disabled={genning}>
            {genning ? "Erzeuge…" : hasToken ? "Token neu erzeugen" : "Token erzeugen"}
          </Button>
        </form>
      </div>
    </div>
  );
}
