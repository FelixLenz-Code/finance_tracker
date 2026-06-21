"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accountSchema, formObject } from "@/lib/validation";

export type AccountState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

function zerr(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path[0]?.toString() ?? "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function createAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const parsed = accountSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: zerr(parsed.error) };

  await prisma.account.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      broker: parsed.data.broker || null,
      baseCurrency: parsed.data.baseCurrency,
    },
  });
  revalidatePath("/accounts");
  revalidatePath("/");
  return {};
}

export async function updateAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = accountSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: zerr(parsed.error) };

  // Ownership-Check via where-Klausel.
  const res = await prisma.account.updateMany({
    where: { id, userId: user.id },
    data: {
      name: parsed.data.name,
      broker: parsed.data.broker || null,
      baseCurrency: parsed.data.baseCurrency,
    },
  });
  if (res.count === 0) return { error: "Konto nicht gefunden." };

  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  // Ownership-Check via where-Klausel.
  await prisma.account.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/accounts");
  revalidatePath("/");
}
