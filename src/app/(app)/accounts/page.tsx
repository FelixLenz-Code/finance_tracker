import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AccountForm } from "./AccountForm";
import { AccountRow } from "./AccountRow";
import { Card } from "@/components/ui";

export default async function AccountsPage() {
  const user = await requireUser();
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    include: { _count: { select: { positions: true, transactions: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Konten</h1>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Neues Depot</h2>
        <AccountForm />
      </Card>

      <div className="space-y-3">
        {accounts.length === 0 && (
          <p className="text-zinc-400">Noch keine Konten angelegt.</p>
        )}
        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            account={{
              id: a.id,
              name: a.name,
              broker: a.broker,
              baseCurrency: a.baseCurrency,
              currencies: a.currencies.length ? a.currencies : [a.baseCurrency],
              positions: a._count.positions,
              transactions: a._count.transactions,
              createdAt: a.createdAt.toISOString(),
            }}
          />
        ))}
      </div>
    </div>
  );
}
