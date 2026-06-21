"use client";

import { useActionState } from "react";
import { Button, Input, Label, Badge, FormError } from "@/components/ui";
import type { SettingsState } from "./actions";

type SaveAction = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
type RemoveAction = () => Promise<void>;

export function ApiKeyField({
  source,
  saveAction,
  removeAction,
  inputLabel,
  helpUrl,
  helpText,
}: {
  source: "db" | "env" | null;
  saveAction: SaveAction;
  removeAction: RemoveAction;
  inputLabel: string;
  helpUrl: string;
  helpText: string;
}) {
  const [state, action, pending] = useActionState(saveAction, {} as SettingsState);

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
          <Badge color="zinc">Nicht konfiguriert</Badge>
        )}
      </div>

      {state.notice && <p className="text-sm text-emerald-300">{state.notice}</p>}
      <FormError message={state.error} />

      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-72 flex-1">
          <Label htmlFor={inputLabel}>{inputLabel}</Label>
          <Input
            id={inputLabel}
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

      {source === "db" && (
        <form
          action={removeAction}
          onSubmit={(e) => {
            if (!confirm("API-Key wirklich entfernen?")) e.preventDefault();
          }}
        >
          <Button type="submit" variant="danger">
            Key entfernen
          </Button>
        </form>
      )}

      <p className="text-xs text-zinc-500">
        {helpText} Wird verschlüsselt in der Datenbank gespeichert und nur serverseitig
        verwendet. Leer speichern entfernt den Key.{" "}
        <a href={helpUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
          Key holen ↗
        </a>
      </p>
    </div>
  );
}
