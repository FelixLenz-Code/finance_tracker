"use client";

import { useState } from "react";
import { Badge, Button, Card, InfoTip, cn } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { money, num, fmtDate, pnlClass } from "@/lib/format";
import type { CcySummary } from "@/lib/cash";
import { CashForm } from "./CashForm";
import { ExchangeForm } from "./ExchangeForm";
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
  dividend?: boolean;
  type?: "DEPOSIT" | "WITHDRAWAL" | "DIVIDEND" | "EXCHANGE";
  symbol?: string | null;
  exchange?: { fromAmount: number; fromCcy: string; toAmount: number; toCcy: string };
};
export type AccountCashView = {
  id: string;
  name: string;
  baseCurrency: string;
  currencies: string[];
  byCcy: CcySummary[];
  holdings: Holding[];
  bookings: Booking[];
  realizedFx: number;
};

/** Kompakte Label→Wert-Zeile innerhalb einer Gruppe. */
function Stat({ label, value, currency, tone = false, info, strong = false }: {
  label: string; value: number; currency: string; tone?: boolean; info?: string; strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center text-xs text-zinc-400">
        {label}
        {info && <InfoTip text={info} />}
      </span>
      <span className={cn(strong ? "text-sm font-semibold" : "text-sm font-medium", tone && pnlClass(value))}>
        {money(value, currency)}
      </span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-950/40 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

/** Waagerechter Anteils-Balken (z. B. frei vs. reserviert). */
function SplitBar({ segments, currency }: {
  segments: { label: string; value: number; color: string }[]; currency: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0);
  if (total <= 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        {segments.map((s, i) =>
          s.value > 0 ? <div key={i} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} /> : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {segments.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", s.color)} />
            {s.label}: <span className="text-zinc-300">{money(s.value, currency)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CurrencyCard({ c, isBase, realizedFx }: { c: CcySummary; isBase: boolean; realizedFx: number }) {
  const freePos = Math.max(c.free, 0);
  return (
    <Card className="space-y-4">
      {/* Hero: Cash-Saldo */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge color="blue">{c.currency}</Badge>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end text-xs text-zinc-500">
            Cash-Saldo
            <InfoTip text="Verfügbares Geld insgesamt = Einzahlungen − Auszahlungen + Dividenden + Cashflows aus Trades (Kauf −, Verkauf/Prämie +, Gebühren −)." />
          </p>
          <p className={cn("text-2xl font-bold", pnlClass(c.cashBalance))}>{money(c.cashBalance, c.currency)}</p>
        </div>
      </div>

      {/* Aufteilung des Cash: frei vs. für Short Puts reserviert */}
      <SplitBar
        currency={c.currency}
        segments={[
          { label: "Frei verfügbar", value: freePos, color: "bg-emerald-500" },
          { label: "Short-Put-Sicherung", value: c.shortPutReserve, color: "bg-amber-500" },
        ]}
      />

      {/* Gruppen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Group title="Liquidität">
          <Stat label="Frei verfügbar" value={c.free} currency={c.currency} tone
            info="Cash-Saldo abzüglich der für Cash-Secured-Puts reservierten Sicherung. Kann negativ sein." />
          <Stat label="Reserviert (Short Puts)" value={c.shortPutReserve} currency={c.currency}
            info="Für Cash-Secured-Puts zurückgelegtes Geld (Strike × 100 × Kontrakte)." />
        </Group>

        <Group title="Gebundenes Kapital">
          <Stat label="Aktien" value={c.boundStock} currency={c.currency}
            info="Wert der gehaltenen Aktien zum Einstand (Stück × Ø-Kurs)." />
          <Stat label="Long-Optionen" value={c.boundLongOption} currency={c.currency}
            info="Für gekaufte Optionen gezahlte Prämien (Prämie × Kontrakte × 100)." />
          <Stat label="Short-Put-Sicherung" value={c.shortPutReserve} currency={c.currency}
            info="Reservierte Sicherung der Short Puts (zählt liquide zum Cash, ist aber gebunden)." />
          <div className="mt-1.5 border-t border-white/5 pt-1.5">
            <Stat label="Gesamt gebunden" value={c.bound} currency={c.currency} strong />
          </div>
        </Group>

        <Group title="Verlauf">
          <Stat label="Eingezahlt (netto)" value={c.deposited} currency={c.currency}
            info="Summe aller Einzahlungen minus Auszahlungen (ohne Dividenden)." />
          <Stat label="Dividenden" value={c.dividends} currency={c.currency} tone
            info="Summe der im Kontostand erfassten Dividendeneingänge." />
          <Stat label="Realisierter G&V" value={c.realizedPnl} currency={c.currency} tone
            info="Realisierter Gewinn/Verlust aus geschlossenen Positionen (inkl. Gebühren)." />
          {isBase && realizedFx !== 0 && (
            <Stat label="Währungsergebnis (real.)" value={realizedFx} currency={c.currency} tone
              info="Realisierter Gewinn/Verlust aus Währungstausch (Ø-Einstand), in Basiswährung." />
          )}
        </Group>
      </div>
    </Card>
  );
}

export function CashView({ accounts }: { accounts: AccountCashView[] }) {
  const [activeId, setActiveId] = useState(accounts[0]?.id ?? "");
  const [showForm, setShowForm] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const acc = accounts.find((a) => a.id === activeId) ?? accounts[0];
  if (!acc) return null;

  return (
    <div className="space-y-5">
      {/* Konto-Umschalter + Buchung */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex flex-wrap gap-2">
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
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowExchange(true)}>
            ⇄ Währungstausch
          </Button>
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            + Buchung
          </Button>
        </div>
      </div>

      {/* Buchung erfassen (Popup) */}
      {showForm && (
        <Modal title={`Buchung · ${acc.name}`} onClose={() => setShowForm(false)}>
          <CashForm
            key={acc.id}
            accountId={acc.id}
            currencies={acc.currencies}
            defaultCurrency={acc.baseCurrency}
            onSuccess={() => setShowForm(false)}
          />
        </Modal>
      )}

      {/* Währungstausch (Popup) */}
      {showExchange && (
        <Modal title={`Währungstausch · ${acc.name}`} onClose={() => setShowExchange(false)}>
          <ExchangeForm
            key={acc.id}
            accountId={acc.id}
            baseCurrency={acc.baseCurrency}
            currencies={acc.currencies}
            onSuccess={() => setShowExchange(false)}
          />
        </Modal>
      )}

      {/* Saldo & Kennzahlen je Währung */}
      {acc.byCcy.map((c) => (
        <CurrencyCard key={c.currency} c={c} isBase={c.currency === acc.baseCurrency} realizedFx={acc.realizedFx} />
      ))}

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
                  <th className="px-3 py-2 text-right">Stück</th>
                  <th className="px-3 py-2 text-right">Ø-Kurs</th>
                  <th className="px-3 py-2 text-right">Einstandswert</th>
                </tr>
              </thead>
              <tbody>
                {acc.holdings.map((h, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 font-medium">{h.symbol}</td>
                    <td className="px-3 py-2 text-right">{num(h.qty, 4)}</td>
                    <td className="px-3 py-2 text-right">{money(h.avg, h.currency)}</td>
                    <td className="px-3 py-2 text-right">{money(h.qty * h.avg, h.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Buchungen */}
      {acc.bookings.length > 0 && (
        <Card>
          <h3 className="mb-2 flex items-center text-sm font-medium text-zinc-300">
            Buchungen
            <InfoTip text="Alle Geldbewegungen: manuelle Ein-/Auszahlungen und Dividenden sowie automatische Cashflows aus Trades." />
          </h3>
          <div className="divide-y divide-white/5 rounded-lg border border-white/5">
            {acc.bookings.map((b) => (
              <div key={b.id} className="flex flex-col gap-1.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-2">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge color={b.type === "EXCHANGE" ? "blue" : b.dividend ? "blue" : b.deletable ? (b.amount >= 0 ? "green" : "amber") : "zinc"}>{b.label}</Badge>
                  <span className="text-zinc-400">{fmtDate(b.date)}</span>
                  {b.note && <span className="min-w-0 truncate text-zinc-500">· {b.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {b.type === "EXCHANGE" && b.exchange ? (
                    <span className="font-medium text-zinc-300">
                      <span className="text-amber-400">−{money(b.exchange.fromAmount, b.exchange.fromCcy)}</span>
                      {" → "}
                      <span className="text-emerald-400">+{money(b.exchange.toAmount, b.exchange.toCcy)}</span>
                    </span>
                  ) : (
                    <span className={cn("font-medium", b.dividend ? "text-blue-400" : b.amount >= 0 ? "text-emerald-400" : "text-amber-400")}>
                      {b.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(b.amount), b.currency)}
                    </span>
                  )}
                  {b.deletable && b.type !== "EXCHANGE" && (
                    <button
                      type="button"
                      onClick={() => setEditBooking(b)}
                      title="Bearbeiten"
                      aria-label="Buchung bearbeiten"
                      className="text-xs text-zinc-500 transition-colors hover:text-emerald-400"
                    >
                      bearbeiten
                    </button>
                  )}
                  {b.deletable && <DeleteCashButton id={b.id} />}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Buchung bearbeiten */}
      {editBooking && editBooking.type && (
        <Modal title="Buchung bearbeiten" onClose={() => setEditBooking(null)}>
          <CashForm
            key={editBooking.id}
            accountId={acc.id}
            currencies={acc.currencies}
            defaultCurrency={acc.baseCurrency}
            initial={{
              id: editBooking.id,
              type: editBooking.type,
              amount: Math.abs(editBooking.amount),
              currency: editBooking.currency,
              date: editBooking.date.slice(0, 10),
              symbol: editBooking.symbol ?? null,
              note: editBooking.note,
            }}
            onSuccess={() => setEditBooking(null)}
          />
        </Modal>
      )}
    </div>
  );
}
