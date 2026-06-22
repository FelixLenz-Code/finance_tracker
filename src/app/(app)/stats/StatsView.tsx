"use client";

import { useMemo, useState } from "react";
import { Card, Select, Label, InfoTip, cn } from "@/components/ui";
import { money, pnlClass } from "@/lib/format";

export type StatRow = {
  accountId: string;
  accountName: string;
  baseCurrency: string;
  instrumentId: string;
  symbol: string;
  name: string;
  kind: "STOCK" | "OPTION";
  status: string;
  currency: string;
  realizedPnl: number;
};

type Bucket = {
  realizedByCcy: Record<string, number>;
  open: number;
  completed: number;
  wins: number;
  rolled: number;
  count: number;
};

function emptyBucket(): Bucket {
  return { realizedByCcy: {}, open: 0, completed: 0, wins: 0, rolled: 0, count: 0 };
}

function add(b: Bucket, r: StatRow) {
  b.count++;
  b.realizedByCcy[r.currency] = (b.realizedByCcy[r.currency] ?? 0) + r.realizedPnl;
  if (r.status === "OPEN") b.open++;
  else {
    b.completed++;
    if (r.realizedPnl > 0) b.wins++;
  }
  if (r.status === "ROLLED") b.rolled++;
}

function bucketOf(rows: StatRow[]): Bucket {
  const b = emptyBucket();
  for (const r of rows) add(b, r);
  return b;
}

function CcyAmounts({ map, align = "left" }: { map: Record<string, number>; align?: "left" | "right" }) {
  const entries = Object.entries(map).filter(([, v]) => v !== 0);
  if (entries.length === 0) return <span className="text-zinc-500">—</span>;
  return (
    <span className={cn("flex flex-wrap gap-x-3", align === "right" && "justify-end")}>
      {entries.map(([ccy, v]) => (
        <span key={ccy} className={cn("font-medium", pnlClass(v))}>
          {money(v, ccy)}
        </span>
      ))}
    </span>
  );
}

function winRatePct(b: Bucket): number | null {
  if (b.completed === 0) return null;
  return Math.round((b.wins / b.completed) * 100);
}

function winRateLabel(b: Bucket): string {
  const p = winRatePct(b);
  return p === null ? "—" : `${p} %`;
}

export function StatsView({
  rows,
  accounts,
}: {
  rows: StatRow[];
  accounts: { id: string; name: string }[];
}) {
  const [account, setAccount] = useState("ALL");
  const [kind, setKind] = useState("ALL");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (account === "ALL" || r.accountId === account) &&
          (kind === "ALL" || r.kind === kind),
      ),
    [rows, account, kind],
  );

  const overall = useMemo(() => bucketOf(filtered), [filtered]);

  const perInstrument = useMemo(() => {
    const map = new Map<string, { symbol: string; name: string; kind: string; b: Bucket }>();
    for (const r of filtered) {
      const cur = map.get(r.instrumentId) ?? { symbol: r.symbol, name: r.name, kind: r.kind, b: emptyBucket() };
      add(cur.b, r);
      map.set(r.instrumentId, cur);
    }
    return [...map.values()].sort(
      (a, z) => sumCcy(z.b.realizedByCcy) - sumCcy(a.b.realizedByCcy),
    );
  }, [filtered]);

  const perAccount = useMemo(() => {
    const map = new Map<string, { name: string; b: Bucket }>();
    for (const r of filtered) {
      const cur = map.get(r.accountId) ?? { name: r.accountName, b: emptyBucket() };
      add(cur.b, r);
      map.set(r.accountId, cur);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [filtered]);

  const winPct = winRatePct(overall);
  const losses = overall.completed - overall.wins;

  const th = "px-3 py-2 text-left font-medium text-zinc-400";
  const thr = "px-3 py-2 text-right font-medium text-zinc-400";
  const td = "px-3 py-2";
  const tdr = "px-3 py-2 text-right";

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="w-56">
          <Label>Depot</Label>
          <Select value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="ALL">Alle Depots zusammen</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Label>Art</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="ALL">Alle</option>
            <option value="STOCK">Aktien</option>
            <option value="OPTION">Optionen</option>
          </Select>
        </div>
      </div>

      {/* Übersichtskarten */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="flex items-center text-xs text-zinc-400">
            Realisierter G&amp;V
            <InfoTip text="Summe realisierter Gewinne/Verluste (geschlossene Positionen, inkl. Gebühren), je Währung getrennt." />
          </p>
          <div className="mt-1 text-base"><CcyAmounts map={overall.realizedByCcy} /></div>
        </Card>
        <Card>
          <p className="flex items-center text-xs text-zinc-400">
            Trefferquote
            <InfoTip text="Anteil abgeschlossener Positionen mit positivem realisiertem G&V." />
          </p>
          <p className="mt-1 text-2xl font-bold">{winRateLabel(overall)}</p>
          {winPct !== null && (
            <>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div className="bg-emerald-500" style={{ width: `${winPct}%` }} />
                <div className="bg-red-500/70" style={{ width: `${100 - winPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">{overall.wins} Gewinne · {losses} Verluste</p>
            </>
          )}
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Offene Positionen</p>
          <p className="mt-1 text-2xl font-bold">{overall.open}</p>
        </Card>
        <Card>
          <p className="flex items-center text-xs text-zinc-400">
            Abgeschlossen
            <InfoTip text="Anzahl nicht mehr offener Positionen (geschlossen, verfallen, angedient, gerollt)." />
          </p>
          <p className="mt-1 text-2xl font-bold">{overall.completed}</p>
          <p className="text-xs text-zinc-500">davon {overall.rolled} gerollt</p>
        </Card>
      </div>

      {/* Pro Depot (nur bei "Alle Depots") */}
      {account === "ALL" && perAccount.length > 1 && (
        <Card>
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Pro Depot</h2>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-xs text-zinc-400">
                <tr>
                  <th className={th}>Depot</th>
                  <th className={thr}>Realisierter G&amp;V</th>
                  <th className={thr}>Offen</th>
                  <th className={thr}>Abgeschl.</th>
                  <th className={thr}>Trefferquote</th>
                </tr>
              </thead>
              <tbody>
                {perAccount.map((a) => (
                  <tr key={a.id} className="border-t border-white/5">
                    <td className={cn(td, "font-medium")}>{a.name}</td>
                    <td className={tdr}><CcyAmounts map={a.b.realizedByCcy} align="right" /></td>
                    <td className={tdr}>{a.b.open}</td>
                    <td className={tdr}>{a.b.completed}</td>
                    <td className={tdr}>{winRateLabel(a.b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pro Instrument */}
      <Card>
        <h2 className="mb-2 text-sm font-medium text-zinc-300">Pro Instrument</h2>
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-xs text-zinc-400">
              <tr>
                <th className={th}>Symbol</th>
                <th className={th}>Name</th>
                <th className={thr}>Realisierter G&amp;V</th>
                <th className={thr}>Positionen</th>
                <th className={thr}>Offen</th>
                <th className={thr}>Trefferquote</th>
              </tr>
            </thead>
            <tbody>
              {perInstrument.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>Keine Daten.</td></tr>
              )}
              {perInstrument.map((i) => (
                <tr key={i.symbol} className="border-t border-white/5">
                  <td className={cn(td, "font-medium")}>{i.symbol}</td>
                  <td className={cn(td, "text-zinc-400")}>{i.name}</td>
                  <td className={tdr}><CcyAmounts map={i.b.realizedByCcy} align="right" /></td>
                  <td className={tdr}>{i.b.count}</td>
                  <td className={tdr}>{i.b.open}</td>
                  <td className={tdr}>{winRateLabel(i.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function sumCcy(map: Record<string, number>): number {
  return Object.values(map).reduce((s, v) => s + v, 0);
}
