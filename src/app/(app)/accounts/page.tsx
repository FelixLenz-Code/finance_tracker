import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { AccountForm } from "./AccountForm";
import { DeleteAccountButton } from "./DeleteAccountButton";

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
          <Card key={a.id} className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.name}</span>
                <span className="text-xs text-zinc-500">{a.baseCurrency}</span>
              </div>
              <p className="text-sm text-zinc-500">
                {a.broker ? `${a.broker} · ` : ""}
                {a._count.positions} Positionen · {a._count.transactions} Transaktionen ·
                seit {fmtDate(a.createdAt)}
              </p>
            </div>
            <DeleteAccountButton id={a.id} name={a.name} />
          </Card>
        ))}
      </div>
    </div>
  );
}
