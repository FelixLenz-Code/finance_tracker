"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Input, Label, FieldError } from "@/components/ui";
import { CurrencyFields } from "./CurrencyFields";
import { createAccount, type AccountState } from "./actions";

export function AccountForm() {
  const [state, action, pending] = useActionState(createAccount, {} as AccountState);
  const formRef = useRef<HTMLFormElement>(null);

  // Nach erfolgreichem Anlegen (kein Fehler, kein FieldError) Formular zurücksetzen.
  const success = !pending && !state.error && !state.fieldErrors;
  useEffect(() => {
    if (success) formRef.current?.reset();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="z.B. IBKR Haupt" required />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div className="min-w-40 flex-1">
          <Label htmlFor="broker">Broker (optional)</Label>
          <Input id="broker" name="broker" placeholder="z.B. Interactive Brokers" />
          <FieldError message={state.fieldErrors?.broker} />
        </div>
      </div>
      <CurrencyFields />
      <Button type="submit" disabled={pending}>
        {pending ? "Anlegen…" : "Konto anlegen"}
      </Button>
    </form>
  );
}
