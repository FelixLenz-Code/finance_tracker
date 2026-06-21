import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, cn } from "@/components/ui";
import { num, pnlClass, toNum } from "@/lib/format";

type Bucket = { byCcy: Record<string, number>; open: number; completed: number; wins: number };

function emptyBucket(): Bucket {
  return { byCcy: {}, open: 0, completed: 0, wins: 0 };
}

function CcyAmounts({ map }: { map: Record<string, number> }) {
  const e = Object.entries(map);
  if (e.length === 0) return <span className="text-zinc-500">—</span>;
  return (
    <span className="space-x-2">
      {e.map(([ccy, v]) => (
        <span key={ccy} className={cn("font-semibold", pnlClass(v))}>
          {num(v)} {ccy}
        </span>
      ))}
    </span>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const positions = await prisma.position.findMany({
    where: { account: { userId: user.id } },
    select: { accountId: true, status: true, currency: true, realizedPnl: true },
  });

  const overall = emptyBucket();
  const perAccount = new Map<string, Bucket>();
  for (const p of positions) {
    const v = toNum(p.realizedPnl);
    const b = perAccount.get(p.accountId) ?? emptyBucket();
    for (const target of [overall, b]) {
      target.byCcy[p.currency] = (target.byCcy[p.currency] ?? 0) + v;
      if (p.status === "OPEN") target.open++;
      else {
        target.completed++;
        if (v > 0) target.wins++;
      }
    }
    perAccount.set(p.accountId, b);
  }

  const winRate = overall.completed > 0 ? `${Math.round((overall.wins / overall.completed) * 100)} %` : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/stats" className="text-sm text-emerald-400">Detaillierte Statistik →</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-zinc-400">Realisierter P&amp;L</p>
          <p className="mt-1 text-lg"><CcyAmounts map={overall.byCcy} /></p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Offene Positionen</p>
          <p className="mt-1 text-2xl font-bold">{overall.open}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Abgeschlossene Trades</p>
          <p className="mt-1 text-2xl font-bold">{overall.completed}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Trefferquote</p>
          <p className="mt-1 text-2xl font-bold">{winRate}</p>
        </Card>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <p className="text-zinc-300">
            Noch keine Konten.{" "}
            <Link href="/accounts" className="text-emerald-400">Erstes Depot anlegen</Link>, dann Trades erfassen.
          </p>
        </Card>
      ) : (
        <div>
          <h2 className="mb-2 text-lg font-medium">Depots</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => {
              const b = perAccount.get(a.id) ?? emptyBucket();
              return (
                <Card key={a.id}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-zinc-500">{a.baseCurrency}</span>
                  </div>
                  {a.broker && <p className="text-sm text-zinc-500">{a.broker}</p>}
                  <p className="mt-2 text-sm"><CcyAmounts map={b.byCcy} /></p>
                  <p className="mt-1 text-xs text-zinc-500">{b.open} offen · {b.completed} abgeschlossen</p>
                  <Link href={`/overview?account=${a.id}`} className="mt-3 inline-block text-sm text-emerald-400">
                    Trades ansehen →
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
