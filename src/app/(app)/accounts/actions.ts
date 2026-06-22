"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accountSchema, formObject } from "@/lib/validation";
import { depotExportSchema, DEPOT_FORMAT } from "@/lib/depot-transfer";
import { importDepot } from "@/lib/depot-import";

export type AccountState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

function zerr(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path[0]?.toString() ?? "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Währungen aus dem Formular: ausgewählte Checkboxen + Basiswährung, dedupliziert. */
function currenciesFrom(formData: FormData, base: string): string[] {
  const picked = formData.getAll("currencies").map((v) => String(v).toUpperCase());
  return Array.from(new Set([base, ...picked]));
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
      currencies: currenciesFrom(formData, parsed.data.baseCurrency),
    },
  });
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/cash");
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
      currencies: currenciesFrom(formData, parsed.data.baseCurrency),
    },
  });
  if (res.count === 0) return { error: "Konto nicht gefunden." };

  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/cash");
  return { ok: true };
}

/**
 * Importiert ein zuvor exportiertes Depot (JSON) als NEUES Konto des aktuellen
 * Users. Instrumente werden global per (symbol, exchange) aufgelöst/angelegt,
 * alle übrigen IDs (Positionen, Roll-Ketten, Transaktionen) werden auf frische
 * IDs umgemappt. Läuft komplett in einer DB-Transaktion (alles-oder-nichts).
 */
export async function importAccount(formData: FormData): Promise<AccountState> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine exportierte Depot-Datei (.json) auswählen." };
  }

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { error: "Datei ist kein gültiges JSON." };
  }

  if (typeof json !== "object" || json === null || (json as { format?: unknown }).format !== DEPOT_FORMAT) {
    return { error: "Unbekanntes Format. Erwartet wird eine vom Trade-Tracker exportierte Depot-Datei." };
  }

  const parsed = depotExportSchema.safeParse(json);
  if (!parsed.success) {
    return { error: `Datei konnte nicht gelesen werden: ${parsed.error.issues[0]?.message ?? "ungültige Struktur"}.` };
  }
  const data = parsed.data;

  try {
    await importDepot(user.id, data);
  } catch (e) {
    return { error: `Import fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannter Fehler"}.` };
  }

  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/cash");
  revalidatePath("/overview");
  revalidatePath("/stats");
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
