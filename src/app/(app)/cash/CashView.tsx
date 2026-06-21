"use client";

import { useState } from "react";
import { Badge, Card, InfoTip, cn } from "@/components/ui";
import { money, num, fmtDate, pnlClass } from "@/lib/format";
import type { CcySummary } from "@/lib/cash";
import { CashForm } from "./CashForm";
import { DeleteCashButton } from "./DeleteCashButton";

export type Holding = { symbol: string; qty: number; avg: number; currency: string };
export type Booking = {
  id: string;
  date: string;
  label: string;
  amount: number;
  currency: string;
  note: string | null;
  deletable: boolean;
};
export type AccountCashView = {
  id: string;
  name: string;
  baseCurrency: string;
  currencies: string[];
  byCcy: CcySummary[];
  holdings: Holding[];
  bookings: Booking[];
};

function Metric({ label, value, currency, tone = false, info }: {
  label: string; value: number; currency: string; tone?: boolean; info?: string;
}) {
  return (
    <div>
      <p className="flex items-center text-xs text-zinc-500">
        {label}
        {info && <InfoTip text={info} />}
      </p>
      <p className={cn("mt-0.5 text-lg font-semibold", tone && pnlClass(value))}>
        {money(value, currency)}
      </p>
    </div>
  );
}

export function CashView({ accounts }: { accounts: AccountCashView[] }) {
  const [activeId, setActiveId] = useState(accounts[0]?.id ?? "");
  const acc = accounts.find((a) => a.id === activeId) ?? accounts[0];
  if (!acc) return null;

  return (
    <div className="space-y-5">
      {/* Konto-Umschalter */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => setActiveId(a.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              a.id === acc.id
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700",
            )}
          >
            {a.name}
          </button>
        ))}
      </div>

      {/* Saldo & Kennzahlen */}
      <Card className="space-y-4">
        <h3 className="text-sm font-medium text-zinc-300">Saldo &amp; Kennzahlen</h3>
        {acc.byCcy.map((c) => (
          <div key={c.currency} className="rounded-lg border border-white/5 bg-zinc-950/40 p-4">
            <div className="mb-3"><Badge color="blue">{c.currency}</Badge></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
              <Metric label="Cash-Saldo" value={c.cashBalance} currency={c.currency} tone
                info="Verfügbares Geld = Einzahlungen − Auszahlungen + Cashflows aus Trades (Kauf −, Verkauf/Prämie +, Gebühren −)." />
              <Metric label="Frei verfügbar" value={c.free} currency={c.currency} tone
                info="Cash-Saldo abzüglich der für Cash-Secured-Puts reservierten Sicherung. Kann negativ sein." />
              <Metric label="Gebundenes Kapital" value={c.bound} currency={c.currency}
                info="Aktien (Stück×Ø-Kurs) + gezahlte Long-Optionsprämien + Short-Put-Sicherung (Strike×100×Kontrakte)." />
              <Metric label="Eingezahlt (netto)" value={c.deposited} currency={c.currency}
                info="Summe aller Einzahlungen minus Auszahlungen." />
              <Metric label="Realisierter P&L" value={c.realizedPnl} currency={c.currency} tone
                info="Realisierter Gewinn/Verlust aus geschlossenen Positionen (inkl. Gebühren)." />
            </div>
            {c.bound > 0 && (
              <p className="mt-3 text-xs text-zinc-500">
                Gebunden: Aktien {money(c.boundStock, c.currency)} · Long-Optionen{" "}
                {money(c.boundLongOption, c.currency)} · Short-Put-Sicherung{" "}
                {money(c.shortPutReserve, c.currency)}
              </p>
            )}
          </div>
        ))}
      </Card>

      {/* Bestand */}
      {acc.holdings.length > 0 && (
        <Card>
          <h3 className="mb-2 flex items-center text-sm font-medium text-zinc-300">
            Bestand (Aktien)
            <InfoTip text="Aktuell gehaltene Aktien mit Stückzahl, Ø-Einstandskurs und Einstandswert." />
          </h3>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-xs text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">Symbol</th>
                  <th className="px-3 py-2 text-left">Stück</th>
                  <th className="px-3 py-2 text-left">Ø-Kurs</th>
                  <th className="px-3 py-2 text-left">Einstandswert</th>
                </tr>
              </thead>
              <tbody>
                {acc.holdings.map((h, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 font-medium">{h.symbol}</td>
                    <td className="px-3 py-2">{num(h.qty, 4)}</td>
                    <td className="px-3 py-2">{money(h.avg, h.currency)}</td>
                    <td className="px-3 py-2">{money(h.qty * h.avg, h.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Ein-/Auszahlung */}
      <Card>
        <h3 className="mb-2 text-sm font-medium text-zinc-300">Ein-/Auszahlung</h3>
        <CashForm accountId={acc.id} currencies={acc.currencies} defaultCurrency={acc.baseCurrency} />
      </Card>

      {/* Buchungen */}
      {acc.bookings.length > 0 && (
        <Card>
          <h3 className="mb-2 flex items-center text-sm font-medium text-zinc-300">
            Buchungen
            <InfoTip text="Alle Geldbewegungen: manuelle Ein-/Auszahlungen und automatische Cashflows aus Trades." />
          </h3>
          <div className="divide-y divide-white/5 rounded-lg border border-white/5">
            {acc.bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge color={b.deletable ? (b.amount >= 0 ? "green" : "amber") : "zinc"}>{b.label}</Badge>
                  <span className="text-zinc-400">{fmtDate(b.date)}</span>
                  {b.note && <span className="text-zinc-500">· {b.note}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className={cn("font-medium", b.amount >= 0 ? "text-emerald-400" : "text-amber-400")}>
                    {b.amount >= 0 ? "+" : "−"}
                    {money(Math.abs(b.amount), b.currency)}
                  </span>
                  {b.deletable && <DeleteCashButton id={b.id} />}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
