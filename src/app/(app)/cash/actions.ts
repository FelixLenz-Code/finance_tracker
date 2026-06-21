"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formObject } from "@/lib/validation";

export type CashState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

const cashSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: z.number().positive("Betrag > 0"),
  currency: z.string().trim().length(3, "3-Buchstaben-Code").toUpperCase(),
  date: z.string().min(1, "Datum erforderlich"),
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

  await prisma.cashTransaction.create({
    data: {
      accountId: parsed.data.accountId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      date: new Date(parsed.data.date),
      note: parsed.data.note || null,
    },
  });
  revalidatePath("/cash");
  revalidatePath("/");
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
