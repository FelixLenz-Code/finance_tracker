"use client";

import { useActionState } from "react";
import { Button, Input, Label, Badge, FormError } from "@/components/ui";
import { saveTwelveDataKey, type SettingsState } from "./actions";

export function TwelveDataKey({
  source,
}: {
  source: "db" | "env" | null;
}) {
  const [state, action, pending] = useActionState(saveTwelveDataKey, {} as SettingsState);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {source ? (
          <>
            <Badge color="green">Konfiguriert</Badge>
            <span className="text-sm text-zinc-400">
              Quelle: {source === "db" ? "in der App gespeichert" : ".env / Umgebung"}
            </span>
          </>
        ) : (
          <>
            <Badge color="zinc">Nicht konfiguriert</Badge>
            <span className="text-sm text-zinc-400">
              Ohne Key funktioniert nur die manuelle Instrument-Eingabe.
            </span>
          </>
        )}
      </div>

      {state.notice && <p className="text-sm text-emerald-300">{state.notice}</p>}
      <FormError message={state.error} />

      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-72 flex-1">
          <Label htmlFor="apiKey">Twelve-Data-API-Key</Label>
          <Input
            id="apiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={source ? "•••••••• (zum Ersetzen neu eingeben)" : "Key hier einfügen"}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern…" : "Speichern"}
        </Button>
      </form>
      <p className="text-xs text-zinc-500">
        Wird verschlüsselt in der Datenbank gespeichert und nur serverseitig verwendet. Leer
        speichern entfernt den Key.{" "}
        <a
          href="https://twelvedata.com/"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-400 hover:underline"
        >
          Kostenlosen Key holen ↗
        </a>
      </p>
    </div>
  );
}
