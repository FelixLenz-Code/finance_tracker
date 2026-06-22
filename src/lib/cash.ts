import "server-only";
import type { Prisma, TxnType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toNum } from "@/lib/format";
import { OPTION_MULTIPLIER } from "@/lib/constants";

type Num = number | string | Prisma.Decimal | null | undefined;

/** Cash-Wirkung einer Trade-Transaktion (Vorzeichen: + Zufluss, − Abfluss). */
export function txnCashFlow(t: {
  type: TxnType;
  qty: Num;
  price: Num;
  fees: Num;
  commission: Num;
}): number {
  const q = toNum(t.qty);
  const p = toNum(t.price);
  const fees = toNum(t.fees) + toNum(t.commission);
  const M = OPTION_MULTIPLIER;
  switch (t.type) {
    case "BUY":
      return -(q * p) - fees;
    case "SELL":
      return q * p - fees;
    case "SELL_TO_OPEN":
    case "SELL_TO_CLOSE":
      return q * p * M - fees;
    case "BUY_TO_OPEN":
    case "BUY_TO_CLOSE":
      return -(q * p * M) - fees;
    case "DIVIDEND":
      return q * p - fees;
    case "FEE":
      return -p - fees;
    // Bei Andienung/Verfall trägt das Aktien-Leg bzw. die offene Prämie den Cashflow.
    case "ASSIGNMENT":
    case "EXPIRATION":
    default:
      return -fees;
  }
}

export type CcySummary = {
  currency: string;
  deposited: number; // Einzahlungen − Auszahlungen
  dividends: number; // erhaltene Dividenden (Cash)
  tradeFlow: number; // Cash aus Trades
  cashBalance: number; // deposited + dividends + tradeFlow
  boundStock: number; // Aktien zu Einstand
  boundLongOption: number; // gezahlte Long-Prämien
  shortPutReserve: number; // Cash-Secured-Puts: Strike×100×Kontrakte
  bound: number; // gebundenes Kapital gesamt
  free: number; // frei verfügbar (cashBalance − Short-Put-Sicherung)
  realizedPnl: number;
};

export type AccountSummary = {
  accountId: string;
  name: string;
  baseCurrency: string;
  byCcy: CcySummary[];
};

function emptyCcy(currency: string): CcySummary {
  return {
    currency,
    deposited: 0,
    dividends: 0,
    tradeFlow: 0,
    cashBalance: 0,
    boundStock: 0,
    boundLongOption: 0,
    shortPutReserve: 0,
    bound: 0,
    free: 0,
    realizedPnl: 0,
  };
}

export async function getCashSummary(userId: string): Promise<AccountSummary[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const accIds = accounts.map((a) => a.id);

  const [cash, txns, positions] = await Promise.all([
    prisma.cashTransaction.findMany({ where: { accountId: { in: accIds } } }),
    prisma.transaction.findMany({
      where: { accountId: { in: accIds } },
      select: { accountId: true, type: true, qty: true, price: true, fees: true, commission: true, currency: true },
    }),
    prisma.position.findMany({
      where: { accountId: { in: accIds } },
      select: {
        accountId: true,
        status: true,
        kind: true,
        direction: true,
        optionRight: true,
        strike: true,
        qty: true,
        avgOpenPrice: true,
        multiplier: true,
        currency: true,
        realizedPnl: true,
      },
    }),
  ]);

  // accountId → currency → CcySummary
  const byAccount = new Map<string, Map<string, CcySummary>>();
  const bucket = (accountId: string, ccy: string) => {
    let ccyMap = byAccount.get(accountId);
    if (!ccyMap) byAccount.set(accountId, (ccyMap = new Map()));
    let b = ccyMap.get(ccy);
    if (!b) ccyMap.set(ccy, (b = emptyCcy(ccy)));
    return b;
  };

  for (const c of cash) {
    const b = bucket(c.accountId, c.currency);
    if (c.type === "DIVIDEND") b.dividends += toNum(c.amount);
    else b.deposited += c.type === "DEPOSIT" ? toNum(c.amount) : -toNum(c.amount);
  }
  for (const t of txns) {
    bucket(t.accountId, t.currency).tradeFlow += txnCashFlow(t);
  }
  for (const p of positions) {
    const b = bucket(p.accountId, p.currency);
    b.realizedPnl += toNum(p.realizedPnl);
    if (p.status !== "OPEN") continue;
    const M = p.multiplier ?? OPTION_MULTIPLIER;
    if (p.kind === "STOCK") {
      b.boundStock += toNum(p.qty) * toNum(p.avgOpenPrice);
    } else if (p.direction === "LONG") {
      b.boundLongOption += toNum(p.qty) * toNum(p.avgOpenPrice) * M;
    } else if (p.optionRight === "PUT") {
      b.shortPutReserve += toNum(p.qty) * toNum(p.strike) * M;
    }
    // Short Call gilt als gedeckt (Aktien sind bereits unter boundStock erfasst).
  }

  return accounts.map((a) => {
    const ccyMap = byAccount.get(a.id) ?? new Map<string, CcySummary>();
    // Alle deklarierten Währungen anzeigen (mind. die Basiswährung).
    const declared = a.currencies.length ? a.currencies : [a.baseCurrency];
    for (const ccy of declared) {
      if (!ccyMap.has(ccy)) ccyMap.set(ccy, emptyCcy(ccy));
    }
    const byCcy = [...ccyMap.values()].map((b) => {
      b.cashBalance = b.deposited + b.dividends + b.tradeFlow;
      b.bound = b.boundStock + b.boundLongOption + b.shortPutReserve;
      b.free = b.cashBalance - b.shortPutReserve;
      return b;
    });
    byCcy.sort((x, y) => (x.currency === a.baseCurrency ? -1 : y.currency === a.baseCurrency ? 1 : x.currency.localeCompare(y.currency)));
    return { accountId: a.id, name: a.name, baseCurrency: a.baseCurrency, byCcy };
  });
}
