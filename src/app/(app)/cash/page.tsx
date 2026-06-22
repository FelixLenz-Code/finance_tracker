import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCashSummary, txnCashFlow } from "@/lib/cash";
import { Card } from "@/components/ui";
import { toNum } from "@/lib/format";
import { CashView, type AccountCashView, type Booking, type Holding } from "./CashView";

const TXN_LABEL: Record<string, string> = {
  BUY: "Kauf",
  SELL: "Verkauf",
  SELL_TO_OPEN: "STO Prämie",
  BUY_TO_OPEN: "BTO Prämie",
  BUY_TO_CLOSE: "BTC Rückkauf",
  SELL_TO_CLOSE: "STC Verkauf",
  ASSIGNMENT: "Andienung",
  EXPIRATION: "Verfall",
  DIVIDEND: "Dividende",
  FEE: "Gebühr",
};

export default async function CashPage() {
  const user = await requireUser();
  const [summary, accounts, txns, holdings] = await Promise.all([
    getCashSummary(user.id),
    prisma.account.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        baseCurrency: true,
        currencies: true,
        cashTransactions: { orderBy: { date: "desc" }, take: 50 },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { account: { userId: user.id } },
      select: {
        id: true, accountId: true, type: true, qty: true, price: true, fees: true,
        commission: true, currency: true, tradeDate: true, notes: true,
        position: { select: { instrument: { select: { symbol: true } } } },
      },
      orderBy: { tradeDate: "desc" },
    }),
    prisma.position.findMany({
      where: { account: { userId: user.id }, kind: "STOCK", status: "OPEN" },
      select: { accountId: true, qty: true, avgOpenPrice: true, currency: true, instrument: { select: { symbol: true } } },
      orderBy: { openedAt: "asc" },
    }),
  ]);

  const meta = new Map(accounts.map((a) => [a.id, a]));

  const bookingsByAccount = new Map<string, Booking[]>();
  const pushBooking = (accId: string, b: Booking) => {
    const arr = bookingsByAccount.get(accId) ?? [];
    arr.push(b);
    bookingsByAccount.set(accId, arr);
  };
  for (const a of accounts) {
    for (const c of a.cashTransactions) {
      pushBooking(a.id, {
        id: c.id, date: c.date.toISOString(), currency: c.currency, note: c.note, deletable: true,
        label: c.type === "WITHDRAWAL" ? "Auszahlung" : c.type === "DIVIDEND" ? `Dividende ${c.symbol ?? ""}`.trim() : "Einzahlung",
        amount: c.type === "WITHDRAWAL" ? -toNum(c.amount) : toNum(c.amount),
        dividend: c.type === "DIVIDEND",
        type: c.type,
        symbol: c.symbol,
      });
    }
  }
  for (const t of txns) {
    const flow = txnCashFlow(t);
    if (flow === 0) continue;
    pushBooking(t.accountId, {
      id: t.id, date: t.tradeDate.toISOString(), currency: t.currency, note: t.notes, deletable: false,
      label: `${TXN_LABEL[t.type] ?? t.type} ${t.position?.instrument.symbol ?? ""}`.trim(),
      amount: flow,
    });
  }

  const holdingsByAccount = new Map<string, Holding[]>();
  for (const h of holdings) {
    const arr = holdingsByAccount.get(h.accountId) ?? [];
    arr.push({ symbol: h.instrument.symbol, qty: toNum(h.qty), avg: toNum(h.avgOpenPrice), currency: h.currency });
    holdingsByAccount.set(h.accountId, arr);
  }

  const views: AccountCashView[] = summary.map((acc) => {
    const m = meta.get(acc.accountId);
    return {
      id: acc.accountId,
      name: acc.name,
      baseCurrency: acc.baseCurrency,
      currencies: m && m.currencies.length ? m.currencies : [acc.baseCurrency],
      byCcy: acc.byCcy,
      holdings: holdingsByAccount.get(acc.accountId) ?? [],
      bookings: (bookingsByAccount.get(acc.accountId) ?? [])
        .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
        .slice(0, 40),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Kontostand</h1>
      {views.length === 0 ? (
        <Card>
          <p className="text-zinc-300">
            Noch keine Depots.{" "}
            <Link href="/accounts" className="text-emerald-400">Depot anlegen</Link>.
          </p>
        </Card>
      ) : (
        <CashView accounts={views} />
      )}
    </div>
  );
}
