"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Input, NumberInput, Label, Select, FieldError, FormError } from "@/components/ui";
import { TickerPicker } from "@/components/TickerPicker";
import { addCashTransaction, updateCashTransaction, type CashState } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export type CashEdit = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  symbol: string | null;
  note: string | null;
};

export function CashForm({
  accountId,
  currencies,
  defaultCurrency,
  initial,
  onSuccess,
}: {
  accountId: string;
  currencies: string[];
  defaultCurrency: string;
  initial?: CashEdit;
  onSuccess?: () => void;
}) {
  const editing = !!initial;
  const [state, action, pending] = useActionState(
    editing ? updateCashTransaction : addCashTransaction,
    {} as CashState,
  );
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [type, setType] = useState(initial?.type ?? "DEPOSIT");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (!editing) formRef.current?.reset();
      onSuccess?.();
    }
  }, [state, onSuccess, editing]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="accountId" value={accountId} />
      {editing && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <Label htmlFor={`type-${accountId}`}>Art</Label>
        <Select id={`type-${accountId}`} name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="DEPOSIT">Einzahlung</option>
          <option value="WITHDRAWAL">Auszahlung</option>
          <option value="DIVIDEND">Dividende</option>
        </Select>
      </div>
      {type === "DIVIDEND" && (
        <div className="w-full">
          <TickerPicker
            symbolOnly
            fieldName="symbol"
            label="Aktie"
            defaultCurrency={currency}
            initialSymbol={initial?.symbol ?? undefined}
          />
          <FieldError message={state.fieldErrors?.symbol} />
        </div>
      )}
      <div className="w-36">
        <Label htmlFor={`amount-${accountId}`}>Betrag</Label>
        <NumberInput id={`amount-${accountId}`} name="amount" unit={currency} defaultValue={initial?.amount} required />
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
        <Input id={`date-${accountId}`} name="date" type="date" defaultValue={initial?.date ?? today()} required />
      </div>
      <div className="min-w-40 flex-1">
        <Label htmlFor={`note-${accountId}`}>Notiz</Label>
        <Input id={`note-${accountId}`} name="note" placeholder="optional" defaultValue={initial?.note ?? ""} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Speichern…" : editing ? "Speichern" : "Buchen"}
      </Button>
      <div className="w-full">
        <FormError message={state.error} />
      </div>
    </form>
  );
}
