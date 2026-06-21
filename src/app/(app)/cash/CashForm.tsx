"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Input, NumberInput, Label, Select, FieldError, FormError } from "@/components/ui";
import { addCashTransaction, type CashState } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export function CashForm({
  accountId,
  currencies,
  defaultCurrency,
}: {
  accountId: string;
  currencies: string[];
  defaultCurrency: string;
}) {
  const [state, action, pending] = useActionState(addCashTransaction, {} as CashState);
  const [currency, setCurrency] = useState(defaultCurrency);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="accountId" value={accountId} />
      <div>
        <Label htmlFor={`type-${accountId}`}>Art</Label>
        <Select id={`type-${accountId}`} name="type" defaultValue="DEPOSIT">
          <option value="DEPOSIT">Einzahlung</option>
          <option value="WITHDRAWAL">Auszahlung</option>
        </Select>
      </div>
      <div className="w-36">
        <Label htmlFor={`amount-${accountId}`}>Betrag</Label>
        <NumberInput id={`amount-${accountId}`} name="amount" unit={currency} required />
        <FieldError message={state.fieldErrors?.amount} />
      </div>
      <div className="w-24">
        <Label htmlFor={`ccy-${accountId}`}>Währung</Label>
        <Select
          id={`ccy-${accountId}`}
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`date-${accountId}`}>Datum</Label>
        <Input id={`date-${accountId}`} name="date" type="date" defaultValue={today()} required />
      </div>
      <div className="min-w-40 flex-1">
        <Label htmlFor={`note-${accountId}`}>Notiz</Label>
        <Input id={`note-${accountId}`} name="note" placeholder="optional" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Buchen…" : "Buchen"}
      </Button>
      <div className="w-full">
        <FormError message={state.error} />
      </div>
    </form>
  );
}
