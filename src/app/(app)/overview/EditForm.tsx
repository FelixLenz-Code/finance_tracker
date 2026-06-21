"use client";

import { useActionState } from "react";
import { Button, Input, NumberInput, Label, Select, FieldError, FormError } from "@/components/ui";
import { editPosition, type TradeState } from "../trades/actions";
import type { Row } from "./types";

const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function EditForm({ r }: { r: Row }) {
  const [state, action, pending] = useActionState(editPosition, {} as TradeState);
  const open = r.transactions[0];
  const fees = open ? open.fees : 0;
  const note = open ? (open.note ?? "") : "";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="positionId" value={r.id} />
      <FormError message={state.error} />

      <p className="text-xs text-zinc-500">
        Bearbeiten von <span className="font-medium text-zinc-300">{r.symbol}</span> ({r.exchange})
      </p>

      {r.kind === "STOCK" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Label>Seite</Label>
            <Select name="side" defaultValue={r.direction === "LONG" ? "BUY" : "SELL"}>
              <option value="BUY">Kauf</option>
              <option value="SELL">Verkauf</option>
            </Select>
          </div>
          <div className="w-28">
            <Label>Anzahl</Label>
            <NumberInput name="qty" unit="Stück" defaultValue={r.qty} required />
            <FieldError message={state.fieldErrors?.qty} />
          </div>
          <div className="w-36">
            <Label>Kurs je Stück</Label>
            <NumberInput name="price" unit={r.currency} defaultValue={r.avgOpenPrice} required />
            <FieldError message={state.fieldErrors?.price} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Label>Richtung</Label>
              <Select name="direction" defaultValue={r.direction}>
                <option value="SHORT">Short (STO)</option>
                <option value="LONG">Long (BTO)</option>
              </Select>
            </div>
            <div className="w-28">
              <Label>Typ</Label>
              <Select name="right" defaultValue={r.optionRight ?? "PUT"}>
                <option value="PUT">Put</option>
                <option value="CALL">Call</option>
              </Select>
            </div>
            <div className="w-28">
              <Label>Strike</Label>
              <NumberInput name="strike" unit={r.currency} defaultValue={r.strike ?? ""} required />
              <FieldError message={state.fieldErrors?.strike} />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Label>Verfall</Label>
              <Input name="expiry" type="date" defaultValue={dateOnly(r.expiry)} required />
              <FieldError message={state.fieldErrors?.expiry} />
            </div>
            <div className="w-28">
              <Label>Kontrakte</Label>
              <NumberInput name="contracts" integer unit="Kontr." defaultValue={r.qty} required />
              <FieldError message={state.fieldErrors?.contracts} />
            </div>
            <div className="w-32">
              <Label>Prämie je Aktie</Label>
              <NumberInput name="premium" unit={r.currency} defaultValue={r.avgOpenPrice} required />
              <FieldError message={state.fieldErrors?.premium} />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Label>Datum</Label>
          <Input name="tradeDate" type="date" defaultValue={dateOnly(r.openedAt)} required />
        </div>
        <div className="w-28">
          <Label>Gebühren</Label>
          <NumberInput name="fees" unit={r.currency} defaultValue={fees} />
        </div>
        <div className="min-w-48 flex-1">
          <Label>Notiz</Label>
          <Input name="notes" defaultValue={note} placeholder="optional" />
        </div>
      </div>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Speichern…" : "Änderungen speichern"}
      </Button>
    </form>
  );
}
