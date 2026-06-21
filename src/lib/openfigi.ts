import "server-only";
import type { InstrumentType } from "@prisma/client";
import type { SymbolHit } from "@/lib/twelvedata";
import { getOpenFigiKey } from "@/lib/settings";

const ENDPOINT = "https://api.openfigi.com/v3/mapping";

/** WKN: 6-stellig alphanumerisch (deutsche Wertpapierkennnummer). */
export function looksLikeWkn(q: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(q.trim());
}

/** ISIN: 2 Buchstaben + 9 alphanumerisch + 1 Prüfziffer (12 Zeichen). */
export function looksLikeIsin(q: string): boolean {
  return /^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$/.test(q.trim());
}

// Bloomberg-Exchange-Codes (von OpenFIGI) → Anzeigename + Währung.
const EXCH: Record<string, { name: string; ccy: string }> = {
  GR: { name: "XETRA", ccy: "EUR" },
  GY: { name: "Deutschland", ccy: "EUR" },
  GF: { name: "Frankfurt", ccy: "EUR" },
  GS: { name: "Stuttgart", ccy: "EUR" },
  GB: { name: "Berlin", ccy: "EUR" },
  GM: { name: "München", ccy: "EUR" },
  GD: { name: "Düsseldorf", ccy: "EUR" },
  GH: { name: "Hamburg", ccy: "EUR" },
  TH: { name: "Tradegate", ccy: "EUR" },
  US: { name: "US", ccy: "USD" },
  UN: { name: "NYSE", ccy: "USD" },
  UW: { name: "NASDAQ", ccy: "USD" },
  UQ: { name: "NASDAQ", ccy: "USD" },
  UP: { name: "NYSE Arca", ccy: "USD" },
  LN: { name: "London", ccy: "GBP" },
  SW: { name: "SIX Swiss", ccy: "CHF" },
  SE: { name: "SIX Swiss", ccy: "CHF" },
  FP: { name: "Paris", ccy: "EUR" },
  NA: { name: "Amsterdam", ccy: "EUR" },
  IM: { name: "Milano", ccy: "EUR" },
  SM: { name: "Madrid", ccy: "EUR" },
  CN: { name: "Toronto", ccy: "CAD" },
  AV: { name: "Wien", ccy: "EUR" },
};

// Sortier-Priorität der Börsen (kleiner = weiter oben).
const PRIO: Record<string, number> = {
  GR: 1, // XETRA
  TH: 2, // Tradegate
  GF: 3,
  US: 1, // US composite
  UW: 2,
  UQ: 2,
  UN: 2,
  SW: 3,
  LN: 3,
};

function mapType(securityType?: string, marketSector?: string): InstrumentType {
  const s = `${securityType ?? ""} ${marketSector ?? ""}`.toLowerCase();
  if (s.includes("etf") || s.includes("etp")) return "ETF";
  if (s.includes("fund")) return "FUND";
  if (s.includes("index")) return "INDEX";
  if (s.includes("equity") || s.includes("stock") || s.includes("share")) return "STOCK";
  return "OTHER";
}

type OpenFigiData = {
  ticker?: string;
  name?: string;
  exchCode?: string;
  securityType?: string;
  marketSector?: string;
};

/** WKN über OpenFIGI auflösen (funktioniert ohne Twelve-Data-Key). */
export function resolveWkn(wkn: string): Promise<SymbolHit[]> {
  return resolveByOpenFigi("ID_WERTPAPIER", wkn);
}

/** ISIN über OpenFIGI auflösen — breite Abdeckung, ohne Twelve-Data-Key. */
export function resolveIsin(isin: string): Promise<SymbolHit[]> {
  return resolveByOpenFigi("ID_ISIN", isin);
}

/**
 * Instrument über OpenFIGI nach ID-Typ auflösen → Instrument-Treffer.
 * Optionaler OPENFIGI_API_KEY erhöht das Rate-Limit.
 */
async function resolveByOpenFigi(idType: string, idValue: string): Promise<SymbolHit[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = await getOpenFigiKey();
  if (apiKey) headers["X-OPENFIGI-APIKEY"] = apiKey;

  let json: Array<{ data?: OpenFigiData[] }>;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify([{ idType, idValue: idValue.trim().toUpperCase() }]),
      next: { revalidate: 86400 }, // ID→Instrument ist stabil → 1 Tag cachen
    });
    if (!res.ok) return [];
    json = await res.json();
  } catch {
    return [];
  }

  const data = json?.[0]?.data ?? [];
  const seen = new Set<string>();
  const ranked: { hit: SymbolHit; prio: number }[] = [];

  for (const d of data) {
    if (!d.ticker || !d.exchCode) continue;
    const exch = EXCH[d.exchCode];
    // Nur bekannte Börsen → korrekte Währung statt Raten.
    if (!exch) continue;
    const key = `${d.ticker}|${exch.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push({
      prio: PRIO[d.exchCode] ?? 50,
      hit: {
        symbol: d.ticker,
        name: d.name ?? d.ticker,
        exchange: exch.name,
        mic: null,
        currency: exch.ccy,
        country: null,
        type: mapType(d.securityType, d.marketSector),
      },
    });
  }

  ranked.sort((a, b) => a.prio - b.prio);
  return ranked.slice(0, 25).map((r) => r.hit);
}
