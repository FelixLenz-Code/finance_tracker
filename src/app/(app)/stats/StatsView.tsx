"use client";

import { useMemo, useState } from "react";
import { Card, Select, Label, cn } from "@/components/ui";
import { num, pnlClass } from "@/lib/format";

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

function CcyAmounts({ map }: { map: Record<string, number> }) {
  const entries = Object.entries(map);
  if (entries.length === 0) return <span className="text-zinc-500">—</span>;
  return (
    <span className="space-x-2">
      {entries.map(([ccy, v]) => (
        <span key={ccy} className={cn("font-medium", pnlClass(v))}>
          {num(v)} {ccy}
        </span>
      ))}
    </span>
  );
}

function winRate(b: Bucket): string {
  if (b.completed === 0) return "—";
  return `${Math.round((b.wins / b.completed) * 100)} %`;
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

  const th = "px-3 py-2 text-left font-medium text-zinc-400";
  const td = "px-3 py-2";

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <p className="text-sm text-zinc-400">Realisierter P&amp;L</p>
          <p className="mt-1 text-lg"><CcyAmounts map={overall.realizedByCcy} /></p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Offene Positionen</p>
          <p className="mt-1 text-2xl font-bold">{overall.open}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Abgeschlossen</p>
          <p className="mt-1 text-2xl font-bold">{overall.completed}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Trefferquote</p>
          <p className="mt-1 text-2xl font-bold">{winRate(overall)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Gerollt</p>
          <p className="mt-1 text-2xl font-bold">{overall.rolled}</p>
        </Card>
      </div>

      {/* Pro Depot (nur bei "Alle Depots") */}
      {account === "ALL" && perAccount.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-medium">Pro Depot</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60">
                <tr>
                  <th className={th}>Depot</th>
                  <th className={th}>Realisierter P&amp;L</th>
                  <th className={th}>Offen</th>
                  <th className={th}>Abgeschlossen</th>
                  <th className={th}>Trefferquote</th>
                </tr>
              </thead>
              <tbody>
                {perAccount.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-800/60">
                    <td className={td}>{a.name}</td>
                    <td className={td}><CcyAmounts map={a.b.realizedByCcy} /></td>
                    <td className={td}>{a.b.open}</td>
                    <td className={td}>{a.b.completed}</td>
                    <td className={td}>{winRate(a.b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pro Instrument */}
      <div>
        <h2 className="mb-2 text-lg font-medium">Pro Instrument</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60">
              <tr>
                <th className={th}>Symbol</th>
                <th className={th}>Name</th>
                <th className={th}>Realisierter P&amp;L</th>
                <th className={th}>Positionen</th>
                <th className={th}>Offen</th>
                <th className={th}>Trefferquote</th>
              </tr>
            </thead>
            <tbody>
              {perInstrument.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>Keine Daten.</td></tr>
              )}
              {perInstrument.map((i) => (
                <tr key={i.symbol} className="border-b border-zinc-800/60">
                  <td className={cn(td, "font-medium")}>{i.symbol}</td>
                  <td className={cn(td, "text-zinc-400")}>{i.name}</td>
                  <td className={td}><CcyAmounts map={i.b.realizedByCcy} /></td>
                  <td className={td}>{i.b.count}</td>
                  <td className={td}>{i.b.open}</td>
                  <td className={td}>{winRate(i.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function sumCcy(map: Record<string, number>): number {
  return Object.values(map).reduce((s, v) => s + v, 0);
}
