import type { Prisma } from "@prisma/client";

type Num = number | string | Prisma.Decimal | null | undefined;

export function toNum(v: Num): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v.toString());
}

export function money(v: Num, currency = "USD"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(toNum(v));
}

export function num(v: Num, digits = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(toNum(v));
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d));
}

/** Deutsche Labels für den Positions-Status (sonst zeigt die UI rohe Enums). */
export const POSITION_STATUS_LABEL: Record<string, string> = {
  OPEN: "Offen",
  CLOSED: "Geschlossen",
  ROLLED: "Gerollt",
  EXPIRED: "Verfallen",
  ASSIGNED: "Angedient",
};

export function statusLabel(s: string): string {
  return POSITION_STATUS_LABEL[s] ?? s;
}

/** Vorzeichen-Klasse für P&L (grün/rot/neutral). */
export function pnlClass(v: Num): string {
  const n = toNum(v);
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-zinc-400";
}
