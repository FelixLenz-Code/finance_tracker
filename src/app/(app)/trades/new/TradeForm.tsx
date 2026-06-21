"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label, Select, FieldError, FormError, cn } from "@/components/ui";
import { TickerPicker } from "@/components/TickerPicker";
import { createTrade, type TradeState } from "../actions";

type Account = { id: string; name: string; baseCurrency: string };

const today = () => new Date().toISOString().slice(0, 10);

export function TradeForm({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState(createTrade, {} as TradeState);
  const [kind, setKind] = useState<"STOCK" | "OPTION">("STOCK");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />

      {/* Art */}
      <div className="flex gap-2">
        {(["STOCK", "OPTION"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium",
              kind === k ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300",
            )}
          >
            {k === "STOCK" ? "Aktie" : "Option"}
          </button>
        ))}
      </div>

      <FormError message={state.error} />

      {/* Konto */}
      <div>
        <Label htmlFor="accountId">Konto</Label>
        <Select id="accountId" name="accountId" required defaultValue={accounts[0]?.id}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.baseCurrency})
            </option>
          ))}
        </Select>
      </div>

      {/* Instrument */}
      <TickerPicker defaultCurrency={accounts[0]?.baseCurrency} />

      {kind === "STOCK" ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="side">Seite</Label>
            <Select id="side" name="side" defaultValue="BUY">
              <option value="BUY">Kauf</option>
              <option value="SELL">Verkauf</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="qty">Stück</Label>
            <Input id="qty" name="qty" inputMode="decimal" required />
            <FieldError message={state.fieldErrors?.qty} />
          </div>
          <div>
            <Label htmlFor="price">Preis</Label>
            <Input id="price" name="price" inputMode="decimal" required />
            <FieldError message={state.fieldErrors?.price} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="direction">Richtung</Label>
              <Select id="direction" name="direction" defaultValue="SHORT">
                <option value="SHORT">Short (Stillhalter / STO)</option>
                <option value="LONG">Long (Käufer / BTO)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="right">Typ</Label>
              <Select id="right" name="right" defaultValue="PUT">
                <option value="PUT">Put</option>
                <option value="CALL">Call</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="strike">Strike</Label>
              <Input id="strike" name="strike" inputMode="decimal" required />
              <FieldError message={state.fieldErrors?.strike} />
            </div>
            <div>
              <Label htmlFor="expiry">Verfall</Label>
              <Input id="expiry" name="expiry" type="date" required />
              <FieldError message={state.fieldErrors?.expiry} />
            </div>
            <div>
              <Label htmlFor="contracts">Kontrakte</Label>
              <Input id="contracts" name="contracts" inputMode="numeric" defaultValue="1" required />
              <FieldError message={state.fieldErrors?.contracts} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="premium">Prämie (pro Aktie)</Label>
              <Input id="premium" name="premium" inputMode="decimal" required />
              <FieldError message={state.fieldErrors?.premium} />
            </div>
          </div>
        </div>
      )}

      {/* Gemeinsame Felder */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tradeDate">Datum</Label>
          <Input id="tradeDate" name="tradeDate" type="date" defaultValue={today()} required />
        </div>
        <div>
          <Label htmlFor="fees">Gebühren</Label>
          <Input id="fees" name="fees" inputMode="decimal" defaultValue="0" />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notiz (optional)</Label>
        <Input id="notes" name="notes" />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Speichern…" : "Trade speichern"}
      </Button>
    </form>
  );
}
