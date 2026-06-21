import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { TradeForm } from "./TradeForm";

export default async function NewTradePage() {
  const user = await requireUser();
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, baseCurrency: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Trade erfassen</h1>
      {accounts.length === 0 ? (
        <Card>
          <p className="text-zinc-300">
            Bitte zuerst ein{" "}
            <Link href="/accounts" className="text-emerald-400">
              Konto anlegen
            </Link>
            .
          </p>
        </Card>
      ) : (
        <Card>
          <TradeForm accounts={accounts} />
        </Card>
      )}
    </div>
  );
}
