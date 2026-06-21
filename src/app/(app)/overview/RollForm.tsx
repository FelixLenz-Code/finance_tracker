"use client";

import { useActionState } from "react";
import { Button, Input, Label, FieldError, FormError } from "@/components/ui";
import { rollOptionAction, type TradeState } from "../trades/actions";

const today = () => new Date().toISOString().slice(0, 10);

export function RollForm({
  positionId,
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
        <div>
          <Label>Buyback-Prämie (alt)</Label>
          <Input name="closePremium" inputMode="decimal" className="w-32" required />
        </div>
        <div>
          <Label>Neuer Strike</Label>
          <Input
            name="newStrike"
            inputMode="decimal"
            defaultValue={currentStrike ?? ""}
            className="w-28"
            required
          />
        </div>
        <div>
          <Label>Neuer Verfall</Label>
          <Input name="newExpiry" type="date" required />
          <FieldError message={state.fieldErrors?.newExpiry} />
        </div>
        <div>
          <Label>Neue Prämie</Label>
          <Input name="newPremium" inputMode="decimal" className="w-28" required />
        </div>
        <div>
          <Label>Gebühren</Label>
          <Input name="fees" defaultValue="0" className="w-24" />
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
