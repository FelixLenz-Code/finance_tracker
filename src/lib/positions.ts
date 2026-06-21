import "server-only";
import { prisma } from "@/lib/db";
import { toNum } from "@/lib/format";
import { OPTION_MULTIPLIER } from "@/lib/constants";
import type { Direction, InstrumentType, OptionRight, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type InstrumentInput = {
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  type: InstrumentType;
  mic?: string | null;
};

export async function upsertInstrument(i: InstrumentInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  return client.instrument.upsert({
    where: { symbol_exchange: { symbol: i.symbol, exchange: i.exchange } },
    update: { name: i.name, currency: i.currency, type: i.type, mic: i.mic ?? null },
    create: {
      symbol: i.symbol,
      exchange: i.exchange,
      name: i.name,
      currency: i.currency,
      type: i.type,
      mic: i.mic ?? null,
    },
  });
}

// ---------- Aktien: Netting mit realisiertem P&L ----------

export async function applyStockTrade(params: {
  accountId: string;
  instrument: InstrumentInput;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  fees: number;
  tradeDate: Date;
  notes?: string;
}) {
  const { accountId, side, qty, price, fees, tradeDate, notes } = params;

  await prisma.$transaction(async (tx) => {
    const instrument = await upsertInstrument(params.instrument, tx);
    const currency = params.instrument.currency;

    const cur = await tx.position.findFirst({
      where: { accountId, instrumentId: instrument.id, kind: "STOCK", status: "OPEN" },
    });

    const curSigned = cur ? (cur.direction === "LONG" ? toNum(cur.qty) : -toNum(cur.qty)) : 0;
    const avg = cur ? toNum(cur.avgOpenPrice) : 0;
    const tradeSigned = side === "BUY" ? qty : -qty;

    // Position bestimmen, dann Transaktion mit korrekter positionId anlegen.
    let txnPositionId = cur?.id ?? null;

    const sameDirection = curSigned === 0 || Math.sign(curSigned) === Math.sign(tradeSigned);

    if (sameDirection) {
      // Aufbauen / neu eröffnen
      const newQty = Math.abs(curSigned) + qty;
      const newAvg = (Math.abs(curSigned) * avg + qty * price) / newQty;
      const direction: Direction = tradeSigned > 0 ? "LONG" : "SHORT";

      if (cur) {
        await tx.position.update({
          where: { id: cur.id },
          data: {
            qty: newQty,
            avgOpenPrice: newAvg,
            realizedPnl: toNum(cur.realizedPnl) - fees,
          },
        });
      } else {
        const pos = await tx.position.create({
          data: {
            accountId,
            instrumentId: instrument.id,
            kind: "STOCK",
            direction,
            status: "OPEN",
            openedAt: tradeDate,
            qty: newQty,
            avgOpenPrice: newAvg,
            realizedPnl: -fees,
            currency,
          },
        });
        txnPositionId = pos.id;
      }
    } else {
      // Reduzieren / schließen / ggf. drehen
      const closingQty = Math.min(qty, Math.abs(curSigned));
      const pnl =
        cur!.direction === "LONG"
          ? (price - avg) * closingQty
          : (avg - price) * closingQty;
      const remainingHolding = Math.abs(curSigned) - closingQty;
      const remainingTrade = qty - closingQty;

      if (remainingHolding > 0) {
        await tx.position.update({
          where: { id: cur!.id },
          data: { qty: remainingHolding, realizedPnl: toNum(cur!.realizedPnl) + pnl - fees },
        });
      } else {
        await tx.position.update({
          where: { id: cur!.id },
          data: {
            qty: 0,
            status: "CLOSED",
            closedAt: tradeDate,
            realizedPnl: toNum(cur!.realizedPnl) + pnl - fees,
          },
        });
        if (remainingTrade > 0) {
          // Position dreht in die Gegenrichtung
          const flipped = await tx.position.create({
            data: {
              accountId,
              instrumentId: instrument.id,
              kind: "STOCK",
              direction: tradeSigned > 0 ? "LONG" : "SHORT",
              status: "OPEN",
              openedAt: tradeDate,
              qty: remainingTrade,
              avgOpenPrice: price,
              realizedPnl: 0,
              currency,
            },
          });
          txnPositionId = flipped.id;
        }
      }
    }

    // Transaktion mit korrekter positionId protokollieren.
    await tx.transaction.create({
      data: {
        accountId,
        positionId: txnPositionId,
        type: side,
        tradeDate,
        qty,
        price,
        fees,
        currency,
        notes: notes || null,
      },
    });
  });
}

// ---------- Optionen ----------

export async function openOption(params: {
  accountId: string;
  instrument: InstrumentInput;
  direction: Direction; // LONG (BTO) | SHORT (STO)
  right: OptionRight;
  strike: number;
  expiry: Date;
  contracts: number;
  premium: number;
  fees: number;
  tradeDate: Date;
  notes?: string;
}) {
  const { accountId, direction, right, strike, expiry, contracts, premium, fees, tradeDate, notes } =
    params;

  await prisma.$transaction(async (tx) => {
    const instrument = await upsertInstrument(params.instrument, tx);
    const chainId = randomUUID();

    const pos = await tx.position.create({
      data: {
        accountId,
        instrumentId: instrument.id,
        kind: "OPTION",
        direction,
        status: "OPEN",
        openedAt: tradeDate,
        qty: contracts,
        avgOpenPrice: premium,
        realizedPnl: -fees,
        currency: params.instrument.currency,
        optionRight: right,
        strike,
        expiry,
        multiplier: OPTION_MULTIPLIER,
        chainId,
      },
    });

    await tx.transaction.create({
      data: {
        accountId,
        positionId: pos.id,
        type: direction === "LONG" ? "BUY_TO_OPEN" : "SELL_TO_OPEN",
        tradeDate,
        qty: contracts,
        price: premium,
        fees,
        currency: params.instrument.currency,
        notes: notes || null,
      },
    });
  });
}

/** Option schließen (STC bei Long, BTC bei Short) mit realisiertem P&L. */
export async function closeOption(params: {
  positionId: string;
  closePremium: number;
  contracts?: number;
  fees: number;
  tradeDate: Date;
  notes?: string;
  tx?: Prisma.TransactionClient;
}) {
  const run = async (tx: Prisma.TransactionClient) => {
    const pos = await tx.position.findUniqueOrThrow({ where: { id: params.positionId } });
    const mult = pos.multiplier ?? OPTION_MULTIPLIER;
    const contracts = params.contracts ?? toNum(pos.qty);
    const avg = toNum(pos.avgOpenPrice);

    const pnl =
      pos.direction === "LONG"
        ? (params.closePremium - avg) * contracts * mult
        : (avg - params.closePremium) * contracts * mult;

    await tx.transaction.create({
      data: {
        accountId: pos.accountId,
        positionId: pos.id,
        type: pos.direction === "LONG" ? "SELL_TO_CLOSE" : "BUY_TO_CLOSE",
        tradeDate: params.tradeDate,
        qty: contracts,
        price: params.closePremium,
        fees: params.fees,
        currency: pos.currency,
        notes: params.notes || null,
      },
    });

    const remaining = toNum(pos.qty) - contracts;
    await tx.position.update({
      where: { id: pos.id },
      data: {
        qty: Math.max(remaining, 0),
        status: remaining > 0 ? "OPEN" : "CLOSED",
        closedAt: remaining > 0 ? null : params.tradeDate,
        realizedPnl: toNum(pos.realizedPnl) + pnl - params.fees,
      },
    });
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction(run);
}

/** Option verfällt (worthless). Short behält Prämie, Long verliert sie. */
export async function expireOption(params: {
  positionId: string;
  tradeDate: Date;
  notes?: string;
}) {
  await prisma.$transaction(async (tx) => {
    const pos = await tx.position.findUniqueOrThrow({ where: { id: params.positionId } });
    const mult = pos.multiplier ?? OPTION_MULTIPLIER;
    const contracts = toNum(pos.qty);
    const avg = toNum(pos.avgOpenPrice);
    const pnl =
      pos.direction === "SHORT" ? avg * contracts * mult : -avg * contracts * mult;

    await tx.transaction.create({
      data: {
        accountId: pos.accountId,
        positionId: pos.id,
        type: "EXPIRATION",
        tradeDate: params.tradeDate,
        qty: contracts,
        price: 0,
        currency: pos.currency,
        notes: params.notes || null,
      },
    });
    await tx.position.update({
      where: { id: pos.id },
      data: {
        qty: 0,
        status: "EXPIRED",
        closedAt: params.tradeDate,
        realizedPnl: toNum(pos.realizedPnl) + pnl,
      },
    });
  });
}

/**
 * Option wird angedient/ausgeübt. Prämie wird realisiert (wie Verfall) und
 * die resultierende Aktienposition automatisch am Strike gebucht.
 */
export async function assignOption(params: {
  positionId: string;
  tradeDate: Date;
  notes?: string;
}) {
  await prisma.$transaction(async (tx) => {
    const pos = await tx.position.findUniqueOrThrow({
      where: { id: params.positionId },
      include: { instrument: true },
    });
    const mult = pos.multiplier ?? OPTION_MULTIPLIER;
    const contracts = toNum(pos.qty);
    const avg = toNum(pos.avgOpenPrice);
    const strike = toNum(pos.strike);

    // Prämie realisieren (Short behält, Long verliert)
    const pnl =
      pos.direction === "SHORT" ? avg * contracts * mult : -avg * contracts * mult;

    await tx.transaction.create({
      data: {
        accountId: pos.accountId,
        positionId: pos.id,
        type: "ASSIGNMENT",
        tradeDate: params.tradeDate,
        qty: contracts,
        price: strike,
        currency: pos.currency,
        notes: params.notes || null,
      },
    });
    await tx.position.update({
      where: { id: pos.id },
      data: {
        qty: 0,
        status: "ASSIGNED",
        closedAt: params.tradeDate,
        realizedPnl: toNum(pos.realizedPnl) + pnl,
      },
    });

    // Aktien-Leg am Strike erzeugen.
    // Short Put / Long Call -> Kauf der Aktien; Short Call / Long Put -> Verkauf.
    const buy =
      (pos.direction === "SHORT" && pos.optionRight === "PUT") ||
      (pos.direction === "LONG" && pos.optionRight === "CALL");
    const shares = contracts * mult;

    // Aktien-Netting wiederverwenden wäre ideal; hier vereinfacht direkt buchen.
    const stockPos = await tx.position.findFirst({
      where: { accountId: pos.accountId, instrumentId: pos.instrumentId, kind: "STOCK", status: "OPEN" },
    });

    let stockPositionId = stockPos?.id ?? null;

    if (stockPos && ((buy && stockPos.direction === "LONG") || (!buy && stockPos.direction === "SHORT"))) {
      const newQty = toNum(stockPos.qty) + shares;
      const newAvg =
        (toNum(stockPos.qty) * toNum(stockPos.avgOpenPrice) + shares * strike) / newQty;
      await tx.position.update({
        where: { id: stockPos.id },
        data: { qty: newQty, avgOpenPrice: newAvg },
      });
    } else if (!stockPos) {
      const newPos = await tx.position.create({
        data: {
          accountId: pos.accountId,
          instrumentId: pos.instrumentId,
          kind: "STOCK",
          direction: buy ? "LONG" : "SHORT",
          status: "OPEN",
          openedAt: params.tradeDate,
          qty: shares,
          avgOpenPrice: strike,
          realizedPnl: 0,
          currency: pos.currency,
        },
      });
      stockPositionId = newPos.id;
    }
    // Hinweis: gegenläufige Bestände (Andienung schließt vorhandene Position)
    // kann der Nutzer bei Bedarf manuell als Verkauf/Kauf nacherfassen.

    await tx.transaction.create({
      data: {
        accountId: pos.accountId,
        positionId: stockPositionId,
        type: buy ? "BUY" : "SELL",
        tradeDate: params.tradeDate,
        qty: shares,
        price: strike,
        currency: pos.currency,
        notes: `Aus Andienung ${pos.instrument.symbol} ${pos.optionRight} ${strike}`,
      },
    });
  });
}

/**
 * Option rollen: bestehende Option schließen (status ROLLED) und neue Option
 * mit gleicher chainId eröffnen. Bündelung in der Übersicht erfolgt via chainId.
 */
export async function rollOption(params: {
  positionId: string;
  closePremium: number;
  newStrike: number;
  newExpiry: Date;
  newPremium: number;
  contracts?: number;
  fees: number;
  tradeDate: Date;
  notes?: string;
}) {
  await prisma.$transaction(async (tx) => {
    const old = await tx.position.findUniqueOrThrow({ where: { id: params.positionId } });
    const mult = old.multiplier ?? OPTION_MULTIPLIER;
    const contracts = params.contracts ?? toNum(old.qty);
    const avg = toNum(old.avgOpenPrice);
    const chainId = old.chainId ?? old.id;

    // Alte Position schließen (Buyback/Sellback)
    const closePnl =
      old.direction === "LONG"
        ? (params.closePremium - avg) * contracts * mult
        : (avg - params.closePremium) * contracts * mult;

    await tx.transaction.create({
      data: {
        accountId: old.accountId,
        positionId: old.id,
        type: old.direction === "LONG" ? "SELL_TO_CLOSE" : "BUY_TO_CLOSE",
        tradeDate: params.tradeDate,
        qty: contracts,
        price: params.closePremium,
        fees: params.fees,
        currency: old.currency,
        notes: params.notes ? `Roll: ${params.notes}` : "Roll: Close",
      },
    });
    await tx.position.update({
      where: { id: old.id },
      data: {
        qty: 0,
        status: "ROLLED",
        closedAt: params.tradeDate,
        chainId,
        realizedPnl: toNum(old.realizedPnl) + closePnl - params.fees,
      },
    });

    // Neue Position eröffnen (gleiche Kette)
    const next = await tx.position.create({
      data: {
        accountId: old.accountId,
        instrumentId: old.instrumentId,
        kind: "OPTION",
        direction: old.direction,
        status: "OPEN",
        openedAt: params.tradeDate,
        qty: contracts,
        avgOpenPrice: params.newPremium,
        realizedPnl: 0,
        currency: old.currency,
        optionRight: old.optionRight,
        strike: params.newStrike,
        expiry: params.newExpiry,
        multiplier: mult,
        chainId,
        prevPositionId: old.id,
      },
    });

    await tx.transaction.create({
      data: {
        accountId: old.accountId,
        positionId: next.id,
        type: old.direction === "LONG" ? "BUY_TO_OPEN" : "SELL_TO_OPEN",
        tradeDate: params.tradeDate,
        qty: contracts,
        price: params.newPremium,
        currency: old.currency,
        notes: "Roll: Open",
      },
    });
  });
}
