"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import type { SettingsState } from "./actions";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

export function MyReminderSettings({
  initial,
  mailConfigured,
  saveAction,
}: {
  initial: { enabled: boolean; days: number; hour: number };
  mailConfigured: boolean;
  saveAction: Action;
}) {
  const [state, save, saving] = useActionState(saveAction, {} as SettingsState);
  const [enabled, setEnabled] = useState(initial.enabled);

  return (
    <div className="space-y-3">
      {!mailConfigured && (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
          Der E-Mail-Versand ist noch nicht eingerichtet — bitte an den Administrator wenden. Deine
          Einstellungen werden trotzdem gespeichert und greifen, sobald E-Mail aktiv ist.
        </p>
      )}
      <form action={save} className="flex flex-wrap items-end gap-4">
        <label className="flex cursor-pointer items-center gap-2 pb-2">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          <span className="text-sm text-zinc-200">E-Mail-Erinnerungen aktiv</span>
        </label>
        <div className="w-44">
          <Label htmlFor="rem-days">Frist (Tage vor Verfall)</Label>
          <Input id="rem-days" name="days" type="number" min="1" max="90" defaultValue={initial.days} disabled={!enabled} />
        </div>
        <div className="w-40">
          <Label htmlFor="rem-hour">Uhrzeit</Label>
          <Select id="rem-hour" name="hour" defaultValue={initial.hour} disabled={!enabled}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
        {state.notice && <span className="pb-2 text-sm text-emerald-300">{state.notice}</span>}
      </form>
      <p className="text-xs text-zinc-500">
        Du erhältst eine tägliche E-Mail, wenn offene Optionen innerhalb der Frist verfallen —
        zur eingestellten Uhrzeit.
      </p>
    </div>
  );
}
