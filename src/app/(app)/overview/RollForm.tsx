"use client";

import { useActionState } from "react";
import { Button, Input, NumberInput, Label, FieldError, FormError } from "@/components/ui";
import { rollOptionAction, type TradeState } from "../trades/actions";

const today = () => new Date().toISOString().slice(0, 10);

export function RollForm({
  positionId,
  currency,
  currentStrike,
}: {
  positionId: string;
  currency: string;
  currentStrike: number | null;
}) {
  const [state, action, pending] = useActionState(rollOptionAction, {} as TradeState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="positionId" value={positionId} />
      <FormError message={state.error} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Label>Buyback-Prämie (alt)</Label>
          <NumberInput name="closePremium" unit={currency} required />
        </div>
        <div className="w-36">
          <Label>Neuer Strike</Label>
          <NumberInput name="newStrike" unit={currency} defaultValue={currentStrike ?? ""} required />
        </div>
        <div>
          <Label>Neuer Verfall</Label>
          <Input name="newExpiry" type="date" required />
          <FieldError message={state.fieldErrors?.newExpiry} />
        </div>
        <div className="w-36">
          <Label>Neue Prämie</Label>
          <NumberInput name="newPremium" unit={currency} required />
        </div>
        <div className="w-28">
          <Label>Gebühren</Label>
          <NumberInput name="fees" unit={currency} defaultValue="0" />
        </div>
        <div>
          <Label>Datum</Label>
          <Input name="tradeDate" type="date" defaultValue={today()} />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Rollen…" : "Rollen"}
        </Button>
      </div>
    </form>
  );
}
