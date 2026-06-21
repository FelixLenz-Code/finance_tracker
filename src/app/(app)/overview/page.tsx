import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNum } from "@/lib/format";
import { OverviewTable } from "./OverviewTable";
import type { Row, Leg, TxnLite } from "./types";

type PositionWithRel = Awaited<ReturnType<typeof loadPositions>>[number];

async function loadPositions(userId: string) {
  return prisma.position.findMany({
    where: { account: { userId } },
    include: {
      instrument: true,
      account: { select: { id: true, name: true, baseCurrency: true } },
      transactions: { orderBy: { tradeDate: "asc" } },
    },
    orderBy: { openedAt: "desc" },
  });
}

function toLeg(p: PositionWithRel): Leg {
  return {
    id: p.id,
    status: p.status,
    direction: p.direction,
    optionRight: p.optionRight,
    strike: p.strike ? toNum(p.strike) : null,
    expiry: p.expiry ? p.expiry.toISOString() : null,
    qty: toNum(p.qty),
    avgOpenPrice: toNum(p.avgOpenPrice),
    realizedPnl: toNum(p.realizedPnl),
    openedAt: p.openedAt.toISOString(),
    closedAt: p.closedAt ? p.closedAt.toISOString() : null,
  };
}

function buildRows(positions: PositionWithRel[]): Row[] {
  const rows: Row[] = [];
  const optionChains = new Map<string, PositionWithRel[]>();

  for (const p of positions) {
    if (p.kind === "OPTION" && p.chainId) {
      const arr = optionChains.get(p.chainId) ?? [];
      arr.push(p);
      optionChains.set(p.chainId, arr);
    } else {
      // Aktie oder Option ohne Kette → eigene Zeile
      rows.push(makeRow(p, [p]));
    }
  }

  for (const legsRaw of optionChains.values()) {
    // Head = die neueste Position der Kette: jene, auf die keine andere via
    // prevPositionId verweist (= das Ende der Roll-Verkettung). Robust auch bei
    // gleichem Eröffnungsdatum. Fallback: jüngste nach openedAt.
    const prevIds = new Set(
      legsRaw.map((p) => p.prevPositionId).filter((x): x is string => Boolean(x)),
    );
    const sortedDesc = [...legsRaw].sort(
      (a, b) => b.openedAt.getTime() - a.openedAt.getTime(),
    );
    const head = legsRaw.find((p) => !prevIds.has(p.id)) ?? sortedDesc[0];
    rows.push(makeRow(head, legsRaw));
  }

  // Nach Eröffnungsdatum des Heads absteigend
  rows.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  return rows;
}

function makeRow(head: PositionWithRel, chain: PositionWithRel[]): Row {
  const realizedSum = chain.reduce((s, p) => s + toNum(p.realizedPnl), 0);
  const legs = chain
    .map(toLeg)
    .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
  const transactions: TxnLite[] = chain
    .flatMap((p) => p.transactions)
    .map((t) => ({
      id: t.id,
      type: t.type,
      qty: toNum(t.qty),
      price: toNum(t.price),
      fees: toNum(t.fees) + toNum(t.commission),
      tradeDate: t.tradeDate.toISOString(),
      currency: t.currency,
      note: t.notes,
    }))
    .sort((a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime());
  return {
    id: head.id,
    kind: head.kind,
    accountId: head.account.id,
    accountName: head.account.name,
    baseCurrency: head.account.baseCurrency,
    symbol: head.instrument.symbol,
    name: head.instrument.name,
    exchange: head.instrument.exchange,
    currency: head.currency,
    direction: head.direction,
    status: head.status,
    optionRight: head.optionRight,
    strike: head.strike ? toNum(head.strike) : null,
    expiry: head.expiry ? head.expiry.toISOString() : null,
    qty: toNum(head.qty),
    avgOpenPrice: toNum(head.avgOpenPrice),
    realizedPnl: realizedSum,
    openedAt: head.openedAt.toISOString(),
    closedAt: head.closedAt ? head.closedAt.toISOString() : null,
    isChain: chain.length > 1,
    legs,
    transactions,
    hasNotes: transactions.some((t) => t.note),
  };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const user = await requireUser();
  const { account } = await searchParams;

  const [positions, accounts] = await Promise.all([
    loadPositions(user.id),
    prisma.account.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows = buildRows(positions);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Trades</h1>
      <OverviewTable rows={rows} accounts={accounts} initialAccount={account} />
    </div>
  );
}
