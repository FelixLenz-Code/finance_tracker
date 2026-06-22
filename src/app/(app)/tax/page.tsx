import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toNum } from "@/lib/format";
import { txnCashFlow } from "@/lib/cash";
import { TaxView, type RealizedItem, type DividendItem, type TradeItem } from "./TaxView";

// Transaktionstypen, die G&V realisieren (zur Bestimmung des Realisierungsdatums).
const CLOSING = new Set(["SELL", "BUY_TO_CLOSE", "SELL_TO_CLOSE", "ASSIGNMENT", "EXPIRATION"]);

export default async function TaxPage() {
  const user = await requireUser();

  const [positions, dividends, accounts] = await Promise.all([
    prisma.position.findMany({
      where: { account: { userId: user.id } },
      select: {
        kind: true,
        realizedPnl: true,
        currency: true,
        openedAt: true,
        closedAt: true,
        instrument: { select: { symbol: true } },
        account: { select: { id: true, name: true } },
        transactions: {
          select: { type: true, tradeDate: true, qty: true, price: true, fees: true, commission: true, currency: true },
        },
      },
    }),
    prisma.cashTransaction.findMany({
      where: { account: { userId: user.id }, type: "DIVIDEND" },
      select: { amount: true, currency: true, date: true, symbol: true, note: true, account: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const realized: RealizedItem[] = [];
  const trades: TradeItem[] = [];

  for (const p of positions) {
    const pnl = toNum(p.realizedPnl);
    if (pnl !== 0) {
      // Realisierungsdatum: Schließdatum, sonst spätestes schließendes Transaktionsdatum
      // (deckt Teilverkäufe bei noch offenen Aktienpositionen ab), sonst Eröffnung.
      let realizedAt = p.closedAt ?? null;
      if (!realizedAt) {
        const closes = p.transactions.filter((t) => CLOSING.has(t.type)).map((t) => t.tradeDate);
        realizedAt = closes.length ? new Date(Math.max(...closes.map((d) => d.getTime()))) : p.openedAt;
      }
      realized.push({
        realizedAt: realizedAt.toISOString(),
        symbol: p.instrument.symbol,
        kind: p.kind,
        accountId: p.account.id,
        accountName: p.account.name,
        currency: p.currency,
        pnl,
      });
    }

    for (const t of p.transactions) {
      trades.push({
        date: t.tradeDate.toISOString(),
        accountId: p.account.id,
        accountName: p.account.name,
        symbol: p.instrument.symbol,
        kind: p.kind,
        type: t.type,
        qty: toNum(t.qty),
        price: toNum(t.price),
        fees: toNum(t.fees) + toNum(t.commission),
        currency: t.currency,
        cashFlow: txnCashFlow(t),
      });
    }
  }

  const divItems: DividendItem[] = dividends.map((d) => ({
    date: d.date.toISOString(),
    accountId: d.account.id,
    accountName: d.account.name,
    currency: d.currency,
    amount: toNum(d.amount),
    symbol: d.symbol,
    note: d.note,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Steuer</h1>
      <TaxView realized={realized} trades={trades} dividends={divItems} accounts={accounts} />
    </div>
  );
}
