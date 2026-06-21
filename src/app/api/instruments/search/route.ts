import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchSymbols, twelveDataConfigured, type SymbolHit } from "@/lib/twelvedata";
import { looksLikeWkn, looksLikeIsin, resolveWkn, resolveIsin } from "@/lib/openfigi";

function dedupe(hits: SymbolHit[]): SymbolHit[] {
  const seen = new Set<string>();
  const out: SymbolHit[] = [];
  for (const h of hits) {
    const key = `${h.symbol}|${h.exchange}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const configured = await twelveDataConfigured();
  if (q.length < 1) return NextResponse.json({ results: [], configured });

  try {
    // ISIN/WKN → OpenFIGI-Auflösung (funktioniert auch ohne Twelve-Data-Key);
    // zusätzlich die Twelve-Data-Suche (Ticker/Name/ISIN). OpenFIGI-Treffer zuerst.
    const figiLookup = looksLikeIsin(q)
      ? resolveIsin(q)
      : looksLikeWkn(q)
        ? resolveWkn(q)
        : Promise.resolve([]);
    const [td, figi] = await Promise.all([searchSymbols(q), figiLookup]);
    const results = dedupe([...figi, ...td]);
    return NextResponse.json({ results, configured });
  } catch {
    return NextResponse.json({ results: [], configured });
  }
}
