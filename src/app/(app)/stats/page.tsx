import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNum } from "@/lib/format";
import { StatsView } from "./StatsView";
import type { StatRow } from "./StatsView";

export default async function StatsPage() {
  const user = await requireUser();

  const positions = await prisma.position.findMany({
    where: { account: { userId: user.id } },
    include: {
      instrument: { select: { id: true, symbol: true, name: true } },
      account: { select: { id: true, name: true, baseCurrency: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const rows: StatRow[] = positions.map((p) => ({
    accountId: p.account.id,
    accountName: p.account.name,
    baseCurrency: p.account.baseCurrency,
    instrumentId: p.instrument.id,
    symbol: p.instrument.symbol,
    name: p.instrument.name,
    kind: p.kind,
    status: p.status,
    currency: p.currency,
    realizedPnl: toNum(p.realizedPnl),
  }));

  const accounts = Array.from(
    new Map(rows.map((r) => [r.accountId, r.accountName])).entries(),
  ).map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Statistik</h1>
      <StatsView rows={rows} accounts={accounts} />
    </div>
  );
}
