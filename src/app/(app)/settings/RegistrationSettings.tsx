"use client";

import { useActionState, useState } from "react";
import { Button, FormError } from "@/components/ui";
import type { SettingsState } from "./actions";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

export function RegistrationSettings({
  initialEnabled,
  saveAction,
}: {
  initialEnabled: boolean;
  saveAction: Action;
}) {
  const [state, save, saving] = useActionState(saveAction, {} as SettingsState);
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <form action={save} className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        <span className="text-sm text-zinc-200">Selbst-Registrierung neuer Nutzer erlauben</span>
      </label>
      <p className="text-xs text-zinc-500">
        Ist dies deaktiviert, können sich keine neuen Nutzer mehr selbst anlegen. Bestehende Konten
        bleiben unberührt.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
        {state.notice && <span className="text-sm text-emerald-300">{state.notice}</span>}
        <FormError message={state.error} />
      </div>
    </form>
  );
}
