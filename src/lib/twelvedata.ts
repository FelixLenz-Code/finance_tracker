import "server-only";
import type { InstrumentType } from "@prisma/client";
import { getTwelveDataKey } from "@/lib/settings";

const BASE = "https://api.twelvedata.com";

export type SymbolHit = {
  symbol: string;
  name: string;
  exchange: string;
  mic: string | null;
  currency: string;
  country: string | null;
  type: InstrumentType;
};

type RawHit = {
  symbol?: string;
  instrument_name?: string;
  exchange?: string;
  mic_code?: string;
  currency?: string;
  country?: string;
  instrument_type?: string;
};

function mapType(raw?: string): InstrumentType {
  const t = (raw ?? "").toLowerCase();
  if (t.includes("etf")) return "ETF";
  if (t.includes("index")) return "INDEX";
  if (t.includes("fund")) return "FUND";
  if (t.includes("stock") || t.includes("share") || t.includes("equity")) return "STOCK";
  return "OTHER";
}

export async function twelveDataConfigured(): Promise<boolean> {
  return (await getTwelveDataKey()) !== null;
}

/**
 * Stammdaten-Suche (symbol_search). Liefert Treffer für das Auto-Fill.
 * KEINE Preisabfrage — Preise werden manuell erfasst.
 */
export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const apikey = await getTwelveDataKey();
  if (!apikey || query.trim().length < 1) return [];

  const url = `${BASE}/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=20&apikey=${apikey}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];

  const json = (await res.json()) as { data?: RawHit[] };
  const data = json.data ?? [];

  return data
    .filter((h) => h.symbol && h.exchange)
    .map((h) => ({
      symbol: h.symbol!,
      name: h.instrument_name ?? h.symbol!,
      exchange: h.exchange!,
      mic: h.mic_code ?? null,
      currency: h.currency ?? "USD",
      country: h.country ?? null,
      type: mapType(h.instrument_type),
    }));
}
