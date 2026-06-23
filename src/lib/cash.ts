import "server-only";
import type { Prisma, TxnType, CashTxnType } from "@prisma/client";
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
  exchanged: number; // Netto-Cash aus Währungstausch (+ Zugang, − Abgang)
  cashBalance: number; // deposited + dividends + tradeFlow + exchanged
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
  realizedFx: number; // realisiertes Währungsergebnis (in Basiswährung)
  realizedFxByCcy: Record<string, number>; // je getauschter Fremdwährung
};

function emptyCcy(currency: string): CcySummary {
  return {
    currency,
    deposited: 0,
    dividends: 0,
    tradeFlow: 0,
    exchanged: 0,
    cashBalance: 0,
    boundStock: 0,
    boundLongOption: 0,
    shortPutReserve: 0,
    bound: 0,
    free: 0,
    realizedPnl: 0,
  };
}

// --- Währungsergebnis (FX) ---
export type FxRealizedEvent = {
  accountId: string;
  date: string; // ISO
  baseCurrency: string; // Ergebnis-Währung (= Basiswährung)
  fromCurrency: string; // getauschte Fremdwährung
  pnl: number; // realisiertes Ergebnis in Basiswährung
};

type FxCash = { type: CashTxnType; amount: Prisma.Decimal | number; currency: string; date: Date; toCurrency: string | null; toAmount: Prisma.Decimal | number | null };
type FxTxn = { type: TxnType; qty: Num; price: Num; fees: Num; commission: Num; currency: string; tradeDate: Date };

/**
 * Realisiertes Währungsergebnis eines Kontos (Ø-Einstand je Fremdwährungs-Topf).
 * Nur Tausch Fremd→Basis realisiert FX; Trades/Dividenden/Ein-/Auszahlungen in
 * Fremdwährung laufen zum laufenden Ø-Kurs mit (kein eigenes FX-Ergebnis).
 */
export function accountFxEvents(
  account: { id: string; baseCurrency: string },
  cashTxns: FxCash[],
  txns: FxTxn[],
): FxRealizedEvent[] {
  const base = account.baseCurrency;
  // Fremdwährung → Menge, Basis-Einstand und zuletzt bekannter Ø-Kurs. `lastAvg`
  // bewertet Zuflüsse, wenn der Topf zwischenzeitlich leer war (z. B. komplett in
  // eine Aktie investiert und nach Verkauf wieder in Cash), damit der Einstand
  // nicht verloren geht und Trade-Gewinne nicht fälschlich als FX-Ergebnis zählen.
  const pots = new Map<string, { qty: number; cost: number; lastAvg: number }>();
  const pot = (c: string) => {
    let p = pots.get(c);
    if (!p) pots.set(c, (p = { qty: 0, cost: 0, lastAvg: 0 }));
    return p;
  };
  const avgOf = (p: { qty: number; cost: number; lastAvg: number }) =>
    p.qty > 1e-9 ? p.cost / p.qty : p.lastAvg;
  const touch = (p: { qty: number; cost: number; lastAvg: number }) => {
    if (p.qty > 1e-9) p.lastAvg = p.cost / p.qty;
  };

  type Step = { t: number; seq: number; run: () => FxRealizedEvent | null };
  const steps: Step[] = [];
  let seq = 0;

  for (const c of cashTxns) {
    const t = c.date.getTime();
    if (c.type === "EXCHANGE") {
      const from = c.currency;
      const to = c.toCurrency ?? "";
      const fromAmt = toNum(c.amount);
      const toAmt = toNum(c.toAmount);
      steps.push({
        t,
        seq: seq++,
        run: () => {
          if (from === base && to !== base) {
            const p = pot(to);
            p.qty += toAmt;
            p.cost += fromAmt;
            touch(p);
            return null;
          }
          if (from !== base && to === base) {
            const p = pot(from);
            const avg = avgOf(p);
            const pnl = toAmt - avg * fromAmt;
            p.qty -= fromAmt;
            p.cost -= avg * fromAmt;
            touch(p);
            return { accountId: account.id, date: new Date(t).toISOString(), baseCurrency: base, fromCurrency: from, pnl };
          }
          return null; // Fremd↔Fremd wird in der UI ausgeschlossen
        },
      });
    } else if (c.currency !== base) {
      const amt = toNum(c.amount);
      const delta = c.type === "WITHDRAWAL" ? -amt : amt;
      steps.push({
        t,
        seq: seq++,
        run: () => {
          const p = pot(c.currency);
          const avg = avgOf(p);
          p.qty += delta;
          p.cost += avg * delta;
          touch(p);
          return null;
        },
      });
    }
  }
  for (const tx of txns) {
    if (tx.currency === base) continue;
    const flow = txnCashFlow(tx);
    if (flow === 0) continue;
    const t = tx.tradeDate.getTime();
    steps.push({
      t,
      seq: seq++,
      run: () => {
        const p = pot(tx.currency);
        const avg = avgOf(p);
        p.qty += flow;
        p.cost += avg * flow;
        touch(p);
        return null;
      },
    });
  }

  steps.sort((a, b) => a.t - b.t || a.seq - b.seq);
  const out: FxRealizedEvent[] = [];
  for (const s of steps) {
    const ev = s.run();
    if (ev) out.push(ev);
  }
  return out;
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
      select: { accountId: true, type: true, qty: true, price: true, fees: true, commission: true, currency: true, tradeDate: true },
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
    if (c.type === "EXCHANGE") {
      bucket(c.accountId, c.currency).exchanged -= toNum(c.amount);
      if (c.toCurrency) bucket(c.accountId, c.toCurrency).exchanged += toNum(c.toAmount);
      continue;
    }
    const b = bucket(c.accountId, c.currency);
    if (c.type === "DIVIDEND") b.dividends += toNum(c.amount);
    else b.deposited += c.type === "DEPOSIT" ? toNum(c.amount) : -toNum(c.amount);
  }
  for (const t of txns) {
    bucket(t.accountId, t.currency).tradeFlow += txnCashFlow(t);
  }

  // Realisiertes Währungsergebnis je Konto (Basiswährung).
  const fxByAccount = new Map<string, { realized: number; byCcy: Record<string, number> }>();
  for (const a of accounts) {
    const evts = accountFxEvents(
      a,
      cash.filter((c) => c.accountId === a.id),
      txns.filter((t) => t.accountId === a.id),
    );
    let realized = 0;
    const byCcy: Record<string, number> = {};
    for (const e of evts) {
      realized += e.pnl;
      byCcy[e.fromCurrency] = (byCcy[e.fromCurrency] ?? 0) + e.pnl;
    }
    fxByAccount.set(a.id, { realized, byCcy });
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
      b.cashBalance = b.deposited + b.dividends + b.tradeFlow + b.exchanged;
      b.bound = b.boundStock + b.boundLongOption + b.shortPutReserve;
      b.free = b.cashBalance - b.shortPutReserve;
      return b;
    });
    byCcy.sort((x, y) => (x.currency === a.baseCurrency ? -1 : y.currency === a.baseCurrency ? 1 : x.currency.localeCompare(y.currency)));
    const fx = fxByAccount.get(a.id) ?? { realized: 0, byCcy: {} };
    return {
      accountId: a.id,
      name: a.name,
      baseCurrency: a.baseCurrency,
      byCcy,
      realizedFx: fx.realized,
      realizedFxByCcy: fx.byCcy,
    };
  });
}

/** Realisierte FX-Events aller Konten eines Nutzers (für den Steuerreport). */
export async function getFxRealizedEvents(userId: string): Promise<FxRealizedEvent[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, baseCurrency: true },
  });
  const accIds = accounts.map((a) => a.id);
  const [cash, txns] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { accountId: { in: accIds } },
      select: { accountId: true, type: true, amount: true, currency: true, date: true, toCurrency: true, toAmount: true },
    }),
    prisma.transaction.findMany({
      where: { accountId: { in: accIds } },
      select: { accountId: true, type: true, qty: true, price: true, fees: true, commission: true, currency: true, tradeDate: true },
    }),
  ]);
  const out: FxRealizedEvent[] = [];
  for (const a of accounts) {
    out.push(
      ...accountFxEvents(
        a,
        cash.filter((c) => c.accountId === a.id),
        txns.filter((t) => t.accountId === a.id),
      ),
    );
  }
  return out;
}
