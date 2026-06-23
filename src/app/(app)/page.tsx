import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCashSummary, type CcySummary } from "@/lib/cash";
import { Card, InfoTip, Badge, cn } from "@/components/ui";
import { NewTradeButton } from "./trades/NewTradeButton";
import { Donut, HBars, CHART_COLORS } from "@/components/charts";
import { OPTION_MULTIPLIER } from "@/lib/constants";
import { money, num, pnlClass, toNum, fmtDate } from "@/lib/format";

function CcyList({ map, tone }: { map: Record<string, number>; tone?: boolean }) {
  const e = Object.entries(map).filter(([, v]) => v !== 0);
  if (e.length === 0) return <span className="text-zinc-500">—</span>;
  return (
    <span className="flex flex-wrap gap-x-3">
      {e.map(([ccy, v]) => (
        <span key={ccy} className={cn("font-semibold", tone && pnlClass(v))}>
          {money(v, ccy)}
        </span>
      ))}
    </span>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [summary, positions, accounts] = await Promise.all([
    getCashSummary(user.id),
    prisma.position.findMany({
      where: { account: { userId: user.id } },
      select: {
        status: true, kind: true, direction: true, optionRight: true, strike: true,
        qty: true, avgOpenPrice: true, multiplier: true, currency: true, realizedPnl: true,
        closedAt: true, expiry: true, instrument: { select: { symbol: true } },
      },
    }),
    prisma.account.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, baseCurrency: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Aggregation über alle Konten je Währung
  const byCcy = new Map<string, CcySummary>();
  for (const acc of summary) {
    for (const c of acc.byCcy) {
      const cur = byCcy.get(c.currency);
      if (!cur) byCcy.set(c.currency, { ...c });
      else
        for (const k of Object.keys(c) as (keyof CcySummary)[])
          if (typeof c[k] === "number") (cur[k] as number) += c[k] as number;
    }
  }
  const currencies = [...byCcy.values()];
  const cashByCcy: Record<string, number> = {};
  const realizedByCcy: Record<string, number> = {};
  const boundByCcy: Record<string, number> = {};
  for (const c of currencies) {
    cashByCcy[c.currency] = c.cashBalance;
    realizedByCcy[c.currency] = c.realizedPnl;
    boundByCcy[c.currency] = c.bound;
  }
  // Realisiertes Währungsergebnis je Basiswährung (über alle Konten).
  const fxByCcy: Record<string, number> = {};
  for (const acc of summary) {
    if (acc.realizedFx) fxByCcy[acc.baseCurrency] = (fxByCcy[acc.baseCurrency] ?? 0) + acc.realizedFx;
  }
  const hasFx = Object.values(fxByCcy).some((v) => v !== 0);

  // Hauptwährung = größtes gebundenes + Cash-Volumen
  const main =
    [...currencies].sort(
      (a, b) => b.bound + Math.abs(b.cashBalance) - (a.bound + Math.abs(a.cashBalance)),
    )[0] ?? null;
  const mainCcy = main?.currency ?? "USD";

  const open = positions.filter((p) => p.status === "OPEN").length;
  const completed = positions.filter((p) => p.status !== "OPEN");
  const wins = completed.filter((p) => toNum(p.realizedPnl) > 0).length;
  const winRate = completed.length > 0 ? `${Math.round((wins / completed.length) * 100)} %` : "—";

  // Bald verfallende offene Optionen (≤ 7 Tage, inkl. überfällig)
  const DAY = 86400000;
  const nowMs = Date.now();
  const expiring = positions
    .filter((p) => p.status === "OPEN" && p.kind === "OPTION" && p.expiry)
    .map((p) => ({
      symbol: p.instrument.symbol,
      optionRight: p.optionRight,
      strike: p.strike ? toNum(p.strike) : null,
      direction: p.direction,
      expiry: p.expiry as Date,
      daysLeft: Math.ceil((((p.expiry as Date).getTime()) - nowMs) / DAY),
    }))
    .filter((o) => o.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Allokation (Hauptwährung)
  const allocation = main
    ? [
        { label: "Frei", value: Math.max(main.free, 0), color: CHART_COLORS[0] },
        { label: "Aktien", value: main.boundStock, color: CHART_COLORS[1] },
        { label: "Long-Optionen", value: main.boundLongOption, color: CHART_COLORS[2] },
        { label: "CSP-Sicherung", value: main.shortPutReserve, color: CHART_COLORS[3] },
      ]
    : [];

  // Gebundenes Kapital pro Instrument (offene Positionen, Hauptwährung)
  const boundBySymbol = new Map<string, number>();
  for (const p of positions) {
    if (p.status !== "OPEN" || p.currency !== mainCcy) continue;
    const M = p.multiplier ?? OPTION_MULTIPLIER;
    let v = 0;
    if (p.kind === "STOCK") v = toNum(p.qty) * toNum(p.avgOpenPrice);
    else if (p.direction === "LONG") v = toNum(p.qty) * toNum(p.avgOpenPrice) * M;
    else if (p.optionRight === "PUT") v = toNum(p.qty) * toNum(p.strike) * M;
    if (v > 0) boundBySymbol.set(p.instrument.symbol, (boundBySymbol.get(p.instrument.symbol) ?? 0) + v);
  }
  const instrumentSegments = [...boundBySymbol.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }));

  // Monatlicher realisierter G&V (Hauptwährung)
  const monthly = new Map<string, number>();
  for (const p of positions) {
    if (!p.closedAt || p.currency !== mainCcy) continue;
    const d = p.closedAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly.set(key, (monthly.get(key) ?? 0) + toNum(p.realizedPnl));
  }
  const monthlyData = [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([k, v]) => ({ label: k.slice(2).replace("-", "/"), value: v }));

  if (summary.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Card>
          <p className="text-zinc-300">
            Noch keine Depots.{" "}
            <Link href="/accounts" className="text-emerald-400">Erstes Depot anlegen</Link>, dann Trades erfassen.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Link href="/stats" className="text-sm text-emerald-400">Detaillierte Statistik →</Link>
          <NewTradeButton accounts={accounts} />
        </div>
      </div>

      {/* Kompakte KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="flex items-center text-xs text-zinc-400">
            Cash-Saldo<InfoTip text="Verfügbares Geld je Währung." />
          </p>
          <div className="mt-1 text-base"><CcyList map={cashByCcy} tone /></div>
        </Card>
        <Card>
          <p className="flex items-center text-xs text-zinc-400">
            Gebundenes Kapital<InfoTip text="Aktien + Long-Optionsprämien + Short-Put-Sicherung." />
          </p>
          <div className="mt-1 text-base"><CcyList map={boundByCcy} /></div>
        </Card>
        <Card>
          <p className="flex items-center text-xs text-zinc-400">
            Realisierter G&V<InfoTip text="Gewinn/Verlust aus geschlossenen Positionen (inkl. Gebühren)." />
          </p>
          <div className="mt-1 text-base"><CcyList map={realizedByCcy} tone /></div>
        </Card>
        <Card>
          <p className="flex items-center text-xs text-zinc-400">
            Trefferquote<InfoTip text="Anteil abgeschlossener Positionen mit Gewinn." />
          </p>
          <p className="mt-1 text-2xl font-bold">{winRate}</p>
          <p className="text-xs text-zinc-500">{open} offen · {completed.length} zu</p>
        </Card>
        {hasFx && (
          <Card>
            <p className="flex items-center text-xs text-zinc-400">
              Währungsergebnis<InfoTip text="Realisierter Gewinn/Verlust aus Währungstausch (Ø-Einstand), je Basiswährung." />
            </p>
            <div className="mt-1 text-base"><CcyList map={fxByCcy} tone /></div>
          </Card>
        )}
      </div>

      {/* Bald verfallende Optionen */}
      {expiring.length > 0 && (
        <Card>
          <h2 className="mb-3 flex items-center text-sm font-medium text-zinc-300">
            Verfällt bald
            <InfoTip text="Offene Optionen, die innerhalb von 7 Tagen verfallen (oder bereits überfällig sind)." />
          </h2>
          <div className="divide-y divide-white/5 rounded-lg border border-white/5">
            {expiring.map((o, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{o.symbol}</span>
                  <span className="text-zinc-400">
                    {o.direction === "SHORT" ? "Short" : "Long"} {o.optionRight ?? ""} {o.strike ?? ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-zinc-400">{fmtDate(o.expiry.toISOString())}</span>
                  <Badge color={o.daysLeft <= 0 ? "red" : o.daysLeft <= 2 ? "amber" : "zinc"}>
                    {o.daysLeft <= 0
                      ? o.daysLeft === 0
                        ? "heute"
                        : `${-o.daysLeft} T überfällig`
                      : `${o.daysLeft} T`}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Kuchendiagramme */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center text-sm font-medium text-zinc-300">
            Kapital-Allokation <span className="ml-1 text-xs text-zinc-500">({mainCcy})</span>
            <InfoTip
              width="w-72"
              text={
                <span className="block space-y-1.5">
                  <span className="block">Aufteilung deines Kapitals (Hauptwährung):</span>
                  <span className="block"><b className="text-emerald-400">Frei</b> — verfügbares Cash, das weder in Aktien steckt noch für Short Puts reserviert ist.</span>
                  <span className="block"><b className="text-blue-400">Aktien</b> — Wert deiner gehaltenen Aktien zum Einstandskurs (Stück × Ø-Kurs).</span>
                  <span className="block"><b className="text-purple-400">Long-Optionen</b> — für gekaufte Optionen gezahlte Prämien (Prämie × Kontrakte × 100).</span>
                  <span className="block"><b className="text-amber-400">CSP-Sicherung</b> — für Short Puts (Cash-Secured) zurückgelegtes Geld (Strike × 100 × Kontrakte).</span>
                </span>
              }
            />
          </h2>
          <Donut segments={allocation} format={(n) => money(n, mainCcy)} />
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center text-sm font-medium text-zinc-300">
            Gebundenes Kapital nach Instrument <span className="ml-1 text-xs text-zinc-500">({mainCcy})</span>
            <InfoTip text="Wie sich das gebundene Kapital der offenen Positionen auf die Instrumente verteilt (Hauptwährung)." />
          </h2>
          <Donut segments={instrumentSegments} format={(n) => money(n, mainCcy)} />
        </Card>
      </div>

      {/* Monatlicher G&V */}
      <Card>
        <h2 className="mb-3 flex items-center text-sm font-medium text-zinc-300">
          Realisierter G&V pro Monat <span className="ml-1 text-xs text-zinc-500">({mainCcy})</span>
          <InfoTip text="Realisierter Gewinn/Verlust je Monat (Schlussdatum) in der Hauptwährung." />
        </h2>
        <HBars data={monthlyData} format={(n) => num(n)} />
      </Card>
    </div>
  );
}
