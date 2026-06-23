"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formObject } from "@/lib/validation";

export type CashState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

const cashSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "DIVIDEND"]),
  amount: z.number().positive("Betrag > 0"),
  currency: z.string().trim().length(3, "3-Buchstaben-Code").toUpperCase(),
  date: z.string().min(1, "Datum erforderlich"),
  symbol: z.string().trim().max(20).optional().or(z.literal("")),
  note: z.string().trim().max(120).optional().or(z.literal("")),
});

function zerr(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path[0]?.toString() ?? "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));

export async function addCashTransaction(
  _prev: CashState,
  formData: FormData,
): Promise<CashState> {
  const user = await requireUser();
  const raw = { ...formObject(formData), amount: num(formData.get("amount")) };
  const parsed = cashSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: zerr(parsed.error) };

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
  });
  if (!account) return { error: "Konto nicht gefunden." };

  // Ein-/Auszahlungen nur in Basiswährung (Fremdwährung entsteht per Tausch);
  // Dividenden dürfen in jeder Währung erfasst werden.
  const currency = parsed.data.type === "DIVIDEND" ? parsed.data.currency : account.baseCurrency;

  await prisma.cashTransaction.create({
    data: {
      accountId: parsed.data.accountId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      currency,
      date: new Date(parsed.data.date),
      symbol: parsed.data.type === "DIVIDEND" ? parsed.data.symbol?.toUpperCase() || null : null,
      note: parsed.data.note || null,
    },
  });
  revalidatePath("/cash");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCashTransaction(
  _prev: CashState,
  formData: FormData,
): Promise<CashState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const raw = { ...formObject(formData), amount: num(formData.get("amount")) };
  const parsed = cashSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: zerr(parsed.error) };

  // Basiswährung des Kontos ermitteln (für die Währungs-Erzwingung).
  const existing = await prisma.cashTransaction.findFirst({
    where: { id, account: { userId: user.id } },
    select: { account: { select: { baseCurrency: true } } },
  });
  if (!existing) return { error: "Buchung nicht gefunden." };
  const currency = parsed.data.type === "DIVIDEND" ? parsed.data.currency : existing.account.baseCurrency;

  // Ownership via verschachtelte where-Klausel; Konto bleibt unverändert.
  const res = await prisma.cashTransaction.updateMany({
    where: { id, account: { userId: user.id } },
    data: {
      type: parsed.data.type,
      amount: parsed.data.amount,
      currency,
      date: new Date(parsed.data.date),
      symbol: parsed.data.type === "DIVIDEND" ? parsed.data.symbol?.toUpperCase() || null : null,
      note: parsed.data.note || null,
    },
  });
  if (res.count === 0) return { error: "Buchung nicht gefunden." };

  revalidatePath("/cash");
  revalidatePath("/");
  revalidatePath("/tax");
  return { ok: true };
}

const exchangeSchema = z.object({
  accountId: z.string().min(1),
  direction: z.enum(["BASE_TO_FX", "FX_TO_BASE"]),
  foreignCurrency: z.string().trim().length(3, "3-Buchstaben-Code").toUpperCase(),
  amount: z.number().positive("Betrag > 0"),
  rate: z.number().positive("Kurs > 0"),
  date: z.string().min(1, "Datum erforderlich"),
  note: z.string().trim().max(120).optional().or(z.literal("")),
});

/** Währungstausch innerhalb eines Depots (eine Seite ist immer die Basiswährung). */
export async function addExchange(
  _prev: CashState,
  formData: FormData,
): Promise<CashState> {
  const user = await requireUser();
  const raw = {
    ...formObject(formData),
    amount: num(formData.get("amount")),
    rate: num(formData.get("rate")),
  };
  const parsed = exchangeSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: zerr(parsed.error) };

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
  });
  if (!account) return { error: "Konto nicht gefunden." };

  const base = account.baseCurrency;
  const fx = parsed.data.foreignCurrency;
  if (fx === base) return { fieldErrors: { foreignCurrency: "Muss von der Basiswährung abweichen." } };

  const baseToFx = parsed.data.direction === "BASE_TO_FX";
  const fromCurrency = baseToFx ? base : fx;
  const toCurrency = baseToFx ? fx : base;
  const amount = parsed.data.amount;
  const toAmount = Math.round(amount * parsed.data.rate * 100) / 100;

  await prisma.$transaction(async (tx) => {
    if (!account.currencies.includes(fx)) {
      await tx.account.update({
        where: { id: account.id },
        data: { currencies: { set: [...new Set([...account.currencies, base, fx])] } },
      });
    }
    await tx.cashTransaction.create({
      data: {
        accountId: account.id,
        type: "EXCHANGE",
        amount,
        currency: fromCurrency,
        toCurrency,
        toAmount,
        date: new Date(parsed.data.date),
        note: parsed.data.note || null,
      },
    });
  });

  revalidatePath("/cash");
  revalidatePath("/");
  revalidatePath("/tax");
  revalidatePath("/stats");
  return { ok: true };
}

export async function deleteCashTransaction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  // Ownership via verschachtelte where-Klausel.
  await prisma.cashTransaction.deleteMany({
    where: { id, account: { userId: user.id } },
  });
  revalidatePath("/cash");
  revalidatePath("/");
}
