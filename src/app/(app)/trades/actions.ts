"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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

export type TradeState = { error?: string; fieldErrors?: Record<string, string> };

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
  redirect("/overview");
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
  return {};
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
