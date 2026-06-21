"use client";

import { useActionState, useEffect, useState } from "react";
import { Card, Button, Input, Label, Select, FieldError, FormError } from "@/components/ui";
import { CURRENCIES } from "@/lib/constants";
import { updateAccount, type AccountState } from "./actions";
import { DeleteAccountButton } from "./DeleteAccountButton";

type Account = {
  id: string;
  name: string;
  broker: string | null;
  baseCurrency: string;
  positions: number;
  transactions: number;
  createdAt: string;
};

export function AccountRow({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateAccount, {} as AccountState);

  useEffect(() => {
    // Nach erfolgreichem Speichern den Bearbeiten-Modus schließen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <Card className="space-y-3">
        <FormError message={state.error} />
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={account.id} />
          <div className="min-w-40 flex-1">
            <Label htmlFor={`name-${account.id}`}>Name</Label>
            <Input id={`name-${account.id}`} name="name" defaultValue={account.name} required />
            <FieldError message={state.fieldErrors?.name} />
          </div>
          <div className="min-w-40 flex-1">
            <Label htmlFor={`broker-${account.id}`}>Broker</Label>
            <Input id={`broker-${account.id}`} name="broker" defaultValue={account.broker ?? ""} />
          </div>
          <div className="w-32">
            <Label htmlFor={`ccy-${account.id}`}>Währung</Label>
            <Select id={`ccy-${account.id}`} name="baseCurrency" defaultValue={account.baseCurrency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Speichern…" : "Speichern"}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Abbrechen</Button>
          </div>
        </form>
        <p className="text-xs text-zinc-500">
          Hinweis: Die Währung ist die Anzeige-/Standardwährung des Depots. Bereits erfasste
          Trades behalten ihre ursprüngliche Währung.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{account.name}</span>
          <span className="text-xs text-zinc-500">{account.baseCurrency}</span>
        </div>
        <p className="text-sm text-zinc-500">
          {account.broker ? `${account.broker} · ` : ""}
          {account.positions} Positionen · {account.transactions} Transaktionen
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-zinc-400 transition-colors hover:text-emerald-400"
        >
          Bearbeiten
        </button>
        <DeleteAccountButton id={account.id} name={account.name} />
      </div>
    </Card>
  );
}
