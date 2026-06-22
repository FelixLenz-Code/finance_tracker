"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toNum } from "@/lib/format";
import type { InstrumentType } from "@prisma/client";
import {
  applyStockTrade,
  openOption,
  closeOption,
  expireOption,
  assignOption,
  rollOption,
  type InstrumentInput,
} from "@/lib/positions";

export type TradeState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

function zerr(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

const INSTR_TYPES: InstrumentType[] = ["STOCK", "ETF", "INDEX", "FUND", "OTHER"];

function instrumentFromForm(f: FormData): InstrumentInput {
  const t = String(f.get("instrType") ?? "STOCK").toUpperCase();
  return {
    symbol: String(f.get("symbol") ?? "").trim().toUpperCase(),
    exchange: String(f.get("exchange") ?? "").trim(),
    name: String(f.get("name") ?? "").trim() || String(f.get("symbol") ?? "").trim(),
    currency: String(f.get("currency") ?? "USD").trim().toUpperCase(),
    type: (INSTR_TYPES.includes(t as InstrumentType) ? t : "STOCK") as InstrumentType,
    mic: (String(f.get("mic") ?? "").trim() || null) as string | null,
  };
}

async function assertAccount(userId: string, accountId: string) {
  const acc = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!acc) throw new Error("Konto nicht gefunden");
  return acc;
}

async function assertPosition(userId: string, positionId: string) {
  const pos = await prisma.position.findFirst({
    where: { id: positionId, account: { userId } },
  });
  if (!pos) throw new Error("Position nicht gefunden");
  return pos;
}

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));

const stockSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  qty: z.number().positive("Menge > 0"),
  price: z.number().nonnegative("Preis ≥ 0"),
});

const optionSchema = z.object({
  direction: z.enum(["LONG", "SHORT"]),
  right: z.enum(["CALL", "PUT"]),
  strike: z.number().positive("Strike > 0"),
  contracts: z.number().int().positive("Kontrakte > 0"),
  premium: z.number().nonnegative("Prämie ≥ 0"),
});

// ---------- Neuen Trade anlegen (Aktie BUY/SELL oder Option öffnen) ----------

export async function createTrade(
  _prev: TradeState,
  formData: FormData,
): Promise<TradeState> {
  const user = await requireUser();

  const accountId = String(formData.get("accountId") ?? "");
  const kind = String(formData.get("kind") ?? "STOCK");
  const instrument = instrumentFromForm(formData);
  const fees = num(formData.get("fees")) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const tradeDateRaw = String(formData.get("tradeDate") ?? "");
  const tradeDate = tradeDateRaw ? new Date(tradeDateRaw) : new Date();

  if (!instrument.symbol || !instrument.exchange) {
    return { error: "Bitte ein Instrument auswählen oder manuell eingeben." };
  }

  try {
    await assertAccount(user.id, accountId);
  } catch {
    return { error: "Ungültiges Konto." };
  }

  if (kind === "STOCK") {
    const parsed = stockSchema.safeParse({
      side: formData.get("side"),
      qty: num(formData.get("qty")),
      price: num(formData.get("price")),
    });
    if (!parsed.success) return { fieldErrors: zerr(parsed.error) };
    await applyStockTrade({
      accountId,
      instrument,
      side: parsed.data.side,
      qty: parsed.data.qty,
      price: parsed.data.price,
      fees,
      tradeDate,
      notes,
    });
  } else {
    const expiryRaw = String(formData.get("expiry") ?? "");
    if (!expiryRaw) return { fieldErrors: { expiry: "Verfall erforderlich" } };
    const parsed = optionSchema.safeParse({
      direction: formData.get("direction"),
      right: formData.get("right"),
      strike: num(formData.get("strike")),
      contracts: num(formData.get("contracts")),
      premium: num(formData.get("premium")),
    });
    if (!parsed.success) return { fieldErrors: zerr(parsed.error) };
    await openOption({
      accountId,
      instrument,
      direction: parsed.data.direction,
      right: parsed.data.right,
      strike: parsed.data.strike,
      expiry: new Date(expiryRaw),
      contracts: parsed.data.contracts,
      premium: parsed.data.premium,
      fees,
      tradeDate,
      notes,
    });
  }

  revalidatePath("/overview");
  revalidatePath("/");
  revalidatePath("/cash");
  return { ok: true };
}

// ---------- Positions-Management (aus der Übersicht) ----------

export async function closePositionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  const pos = await assertPosition(user.id, positionId);
  const tradeDate = new Date(String(formData.get("tradeDate") ?? "") || Date.now());
  const fees = num(formData.get("fees")) || 0;

  if (pos.kind === "OPTION") {
    await closeOption({
      positionId,
      closePremium: num(formData.get("price")) || 0,
      fees,
      tradeDate,
    });
  } else {
    // Aktie schließen = Gegen-Trade über die Netting-Logik
    await applyStockTrade({
      accountId: pos.accountId,
      instrument: await instrumentForPosition(pos.instrumentId),
      side: pos.direction === "LONG" ? "SELL" : "BUY",
      qty: num(formData.get("qty")) || Number(pos.qty),
      price: num(formData.get("price")) || 0,
      fees,
      tradeDate,
    });
  }
  revalidatePath("/overview");
  revalidatePath("/");
}

/**
 * Eintrag bearbeiten — nur im Anfangszustand (Status OPEN, genau eine Buchung),
 * also bevor geschlossen/gerollt/teilverkauft wurde. Überschreibt Position + Buchung.
 */
export async function editPosition(
  _prev: TradeState,
  formData: FormData,
): Promise<TradeState> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  const pos = await prisma.position.findFirst({
    where: { id: positionId, account: { userId: user.id } },
    include: { transactions: true },
  });
  if (!pos) return { error: "Position nicht gefunden." };
  if (pos.status !== "OPEN" || pos.transactions.length !== 1) {
    return {
      error:
        "Nur direkt nach dem Anlegen editierbar (noch keine weiteren Buchungen). Sonst bitte den Eintrag löschen und neu erfassen.",
    };
  }
  const txn = pos.transactions[0];
  const fees = num(formData.get("fees")) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tradeDate = new Date(String(formData.get("tradeDate") ?? "") || pos.openedAt.toISOString());

  if (pos.kind === "STOCK") {
    const parsed = stockSchema.safeParse({
      side: formData.get("side"),
      qty: num(formData.get("qty")),
      price: num(formData.get("price")),
    });
    if (!parsed.success) return { fieldErrors: zerr(parsed.error) };
    await prisma.$transaction([
      prisma.position.update({
        where: { id: pos.id },
        data: {
          direction: parsed.data.side === "BUY" ? "LONG" : "SHORT",
          qty: parsed.data.qty,
          avgOpenPrice: parsed.data.price,
          openedAt: tradeDate,
          realizedPnl: -fees,
        },
      }),
      prisma.transaction.update({
        where: { id: txn.id },
        data: { type: parsed.data.side, qty: parsed.data.qty, price: parsed.data.price, fees, tradeDate, notes },
      }),
    ]);
  } else {
    const expiryRaw = String(formData.get("expiry") ?? "");
    if (!expiryRaw) return { fieldErrors: { expiry: "Verfall erforderlich" } };
    const parsed = optionSchema.safeParse({
      direction: formData.get("direction"),
      right: formData.get("right"),
      strike: num(formData.get("strike")),
      contracts: num(formData.get("contracts")),
      premium: num(formData.get("premium")),
    });
    if (!parsed.success) return { fieldErrors: zerr(parsed.error) };
    await prisma.$transaction([
      prisma.position.update({
        where: { id: pos.id },
        data: {
          direction: parsed.data.direction,
          optionRight: parsed.data.right,
          strike: parsed.data.strike,
          expiry: new Date(expiryRaw),
          qty: parsed.data.contracts,
          avgOpenPrice: parsed.data.premium,
          openedAt: tradeDate,
          realizedPnl: -fees,
        },
      }),
      prisma.transaction.update({
        where: { id: txn.id },
        data: {
          type: parsed.data.direction === "LONG" ? "BUY_TO_OPEN" : "SELL_TO_OPEN",
          qty: parsed.data.contracts,
          price: parsed.data.premium,
          fees,
          tradeDate,
          notes,
        },
      }),
    ]);
  }
  revalidatePath("/overview");
  revalidatePath("/");
  revalidatePath("/cash");
  return { ok: true };
}

/** Letzten Roll rückgängig machen: neueste (offene) Position der Kette löschen, Vorgänger wieder öffnen. */
export async function undoRollAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  const head = await prisma.position.findFirst({
    where: { id: positionId, account: { userId: user.id }, prevPositionId: { not: null } },
    include: { transactions: true, prev: { include: { transactions: true } } },
  });
  if (!head || !head.prev) return;
  const prev = head.prev;

  await prisma.$transaction(async (tx) => {
    // Neue (gerollte) Position + deren Buchungen entfernen
    await tx.transaction.deleteMany({ where: { positionId: head.id } });
    await tx.position.update({ where: { id: head.id }, data: { prevPositionId: null } });
    await tx.position.delete({ where: { id: head.id } });

    // Vorgänger wieder öffnen: Roll-Close-Buchung entfernen, Anfangszustand herstellen
    const openTxn = prev.transactions.find(
      (t) => t.type === "BUY_TO_OPEN" || t.type === "SELL_TO_OPEN",
    );
    await tx.transaction.deleteMany({
      where: { positionId: prev.id, type: { in: ["BUY_TO_CLOSE", "SELL_TO_CLOSE"] } },
    });
    await tx.position.update({
      where: { id: prev.id },
      data: {
        status: "OPEN",
        closedAt: null,
        qty: openTxn ? openTxn.qty : prev.qty,
        avgOpenPrice: openTxn ? openTxn.price : prev.avgOpenPrice,
        realizedPnl: openTxn ? -(toNum(openTxn.fees) + toNum(openTxn.commission)) : 0,
      },
    });
  });
  revalidatePath("/overview");
  revalidatePath("/");
  revalidatePath("/cash");
}

/** Geschlossene/verfallene/angediente Option wieder öffnen (Misklick rückgängig). */
export async function reopenOptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  const pos = await prisma.position.findFirst({
    where: {
      id: positionId,
      account: { userId: user.id },
      kind: "OPTION",
      status: { in: ["CLOSED", "EXPIRED", "ASSIGNED"] },
    },
    include: { transactions: true, instrument: true, next: true },
  });
  if (!pos || pos.next) return; // gerollte Positionen nicht hier behandeln

  await prisma.$transaction(async (tx) => {
    // Abschluss-Buchungen entfernen
    await tx.transaction.deleteMany({
      where: {
        positionId: pos.id,
        type: { in: ["BUY_TO_CLOSE", "SELL_TO_CLOSE", "EXPIRATION", "ASSIGNMENT"] },
      },
    });

    // Bei Andienung erzeugtes Aktien-Leg entfernen (best effort: eigenständige Position).
    if (pos.status === "ASSIGNED") {
      const legNotePrefix = `Aus Andienung ${pos.instrument.symbol}`;
      const legTxns = await tx.transaction.findMany({
        where: { accountId: pos.accountId, notes: { startsWith: legNotePrefix } },
        select: { id: true, positionId: true },
      });
      for (const leg of legTxns) {
        await tx.transaction.delete({ where: { id: leg.id } });
        if (leg.positionId) {
          const remaining = await tx.transaction.count({ where: { positionId: leg.positionId } });
          if (remaining === 0) await tx.position.delete({ where: { id: leg.positionId } });
        }
      }
    }

    const openTxn = pos.transactions.find(
      (t) => t.type === "BUY_TO_OPEN" || t.type === "SELL_TO_OPEN",
    );
    await tx.position.update({
      where: { id: pos.id },
      data: {
        status: "OPEN",
        closedAt: null,
        qty: openTxn ? openTxn.qty : pos.qty,
        avgOpenPrice: openTxn ? openTxn.price : pos.avgOpenPrice,
        realizedPnl: openTxn ? -(toNum(openTxn.fees) + toNum(openTxn.commission)) : 0,
      },
    });
  });
  revalidatePath("/overview");
  revalidatePath("/");
  revalidatePath("/cash");
}

/** Notiz einer Transaktion bearbeiten (leer = entfernen). */
export async function saveTransactionNote(transactionId: string, note: string): Promise<void> {
  const user = await requireUser();
  await prisma.transaction.updateMany({
    where: { id: transactionId, account: { userId: user.id } },
    data: { notes: note.trim() || null },
  });
  revalidatePath("/overview");
  revalidatePath("/cash");
}

/** Eintrag löschen: Position + ihre Transaktionen; bei Roll-Ketten die ganze Kette. */
export async function deletePosition(formData: FormData): Promise<void> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  const pos = await assertPosition(user.id, positionId);

  const where = pos.chainId
    ? { chainId: pos.chainId, account: { userId: user.id } }
    : { id: pos.id, account: { userId: user.id } };

  await prisma.$transaction(async (tx) => {
    const positions = await tx.position.findMany({ where, select: { id: true } });
    const ids = positions.map((p) => p.id);
    await tx.transaction.deleteMany({ where: { positionId: { in: ids } } });
    // Self-FK (prevPositionId) lösen, dann Positionen entfernen.
    await tx.position.updateMany({ where: { id: { in: ids } }, data: { prevPositionId: null } });
    await tx.position.deleteMany({ where: { id: { in: ids } } });
  });

  revalidatePath("/overview");
  revalidatePath("/");
  revalidatePath("/stats");
}

export async function expireOptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  await assertPosition(user.id, positionId);
  await expireOption({
    positionId,
    tradeDate: new Date(String(formData.get("tradeDate") ?? "") || Date.now()),
  });
  revalidatePath("/overview");
  revalidatePath("/");
}

export async function assignOptionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  await assertPosition(user.id, positionId);
  await assignOption({
    positionId,
    tradeDate: new Date(String(formData.get("tradeDate") ?? "") || Date.now()),
  });
  revalidatePath("/overview");
  revalidatePath("/");
}

export async function rollOptionAction(
  _prev: TradeState,
  formData: FormData,
): Promise<TradeState> {
  const user = await requireUser();
  const positionId = String(formData.get("positionId") ?? "");
  await assertPosition(user.id, positionId);

  const newExpiry = String(formData.get("newExpiry") ?? "");
  if (!newExpiry) return { fieldErrors: { newExpiry: "Neuer Verfall erforderlich" } };

  await rollOption({
    positionId,
    closePremium: num(formData.get("closePremium")) || 0,
    newStrike: num(formData.get("newStrike")) || 0,
    newExpiry: new Date(newExpiry),
    newPremium: num(formData.get("newPremium")) || 0,
    fees: num(formData.get("fees")) || 0,
    tradeDate: new Date(String(formData.get("tradeDate") ?? "") || Date.now()),
  });
  revalidatePath("/overview");
  revalidatePath("/");
  return { ok: true };
}

async function instrumentForPosition(instrumentId: string): Promise<InstrumentInput> {
  const i = await prisma.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
  return {
    symbol: i.symbol,
    exchange: i.exchange,
    name: i.name,
    currency: i.currency,
    type: i.type,
    mic: i.mic,
  };
}
