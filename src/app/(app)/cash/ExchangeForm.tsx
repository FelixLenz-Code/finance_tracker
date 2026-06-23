"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Input, NumberInput, Label, Select, FieldError, FormError } from "@/components/ui";
import { money } from "@/lib/format";
import { addExchange, type CashState } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export function ExchangeForm({
  accountId,
  baseCurrency,
  currencies,
  onSuccess,
}: {
  accountId: string;
  baseCurrency: string;
  currencies: string[];
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(addExchange, {} as CashState);
  const [direction, setDirection] = useState<"BASE_TO_FX" | "FX_TO_BASE">("BASE_TO_FX");
  const otherCurrencies = currencies.filter((c) => c !== baseCurrency);
  const [foreign, setForeign] = useState(otherCurrencies[0] ?? "");
  const [amount, setAmount] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state, onSuccess]);

  const fx = (foreign || "FX").toUpperCase();
  const fromCcy = direction === "BASE_TO_FX" ? baseCurrency : fx;
  const toCcy = direction === "BASE_TO_FX" ? fx : baseCurrency;
  const toAmount = amount > 0 && rate > 0 ? Math.round(amount * rate * 100) / 100 : 0;

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Label htmlFor={`dir-${accountId}`}>Richtung</Label>
          <Select
            id={`dir-${accountId}`}
            name="direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "BASE_TO_FX" | "FX_TO_BASE")}
          >
            <option value="BASE_TO_FX">{baseCurrency} → Fremdwährung</option>
            <option value="FX_TO_BASE">Fremdwährung → {baseCurrency}</option>
          </Select>
        </div>
        <div className="w-32">
          <Label htmlFor={`fx-${accountId}`}>Fremdwährung</Label>
          <Input
            id={`fx-${accountId}`}
            name="foreignCurrency"
            list={`ccy-list-${accountId}`}
            value={foreign}
            onChange={(e) => setForeign(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="USD"
            required
          />
          <datalist id={`ccy-list-${accountId}`}>
            {otherCurrencies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <FieldError message={state.fieldErrors?.foreignCurrency} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Label htmlFor={`amt-${accountId}`}>Betrag ({fromCcy})</Label>
          <NumberInput
            id={`amt-${accountId}`}
            name="amount"
            unit={fromCcy}
            onChange={(e) => setAmount(Number(String(e.target.value).replace(",", ".")))}
            required
          />
          <FieldError message={state.fieldErrors?.amount} />
        </div>
        <div className="w-44">
          <Label htmlFor={`rate-${accountId}`}>Kurs (1 {fromCcy} = ? {toCcy})</Label>
          <NumberInput
            id={`rate-${accountId}`}
            name="rate"
            onChange={(e) => setRate(Number(String(e.target.value).replace(",", ".")))}
            required
          />
          <FieldError message={state.fieldErrors?.rate} />
        </div>
        <div>
          <Label htmlFor={`date-${accountId}`}>Datum</Label>
          <Input id={`date-${accountId}`} name="date" type="date" defaultValue={today()} required />
        </div>
      </div>

      <p className="text-sm text-zinc-400">
        Du gibst <span className="font-medium text-zinc-200">{money(amount || 0, fromCcy)}</span> und erhältst{" "}
        <span className="font-medium text-emerald-300">{money(toAmount, toCcy)}</span>.
      </p>

      <div>
        <Label htmlFor={`note-ex-${accountId}`}>Notiz</Label>
        <Input id={`note-ex-${accountId}`} name="note" placeholder="optional" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Tauschen…" : "Tausch buchen"}</Button>
        <FormError message={state.error} />
      </div>
    </form>
  );
}
