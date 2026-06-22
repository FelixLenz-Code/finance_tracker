"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Label, Select, Badge, cn } from "@/components/ui";
import { CURRENCIES, instrumentTypeLabel } from "@/lib/constants";

export type Picked = {
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  type: string;
  mic: string | null;
};

type ApiHit = {
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  type: string;
  mic: string | null;
};

export function TickerPicker({
  defaultCurrency = "USD",
  onCurrency,
  symbolOnly = false,
  fieldName = "symbol",
  label,
  initialSymbol,
}: {
  defaultCurrency?: string;
  onCurrency?: (currency: string | null) => void;
  /** Nur das Symbol erfassen (keine Börse/Währung/Name-Felder) — z. B. für Dividenden. */
  symbolOnly?: boolean;
  /** Name des verborgenen Symbol-Felds (Standard: "symbol"). */
  fieldName?: string;
  /** Beschriftung des Felds. */
  label?: string;
  /** Vorbelegtes Symbol (z. B. beim Bearbeiten). */
  initialSymbol?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [picked, setPicked] = useState<Picked | null>(
    initialSymbol
      ? { symbol: initialSymbol, exchange: "", name: "", currency: defaultCurrency, type: "STOCK", mic: null }
      : null,
  );
  const [manual, setManual] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced Suche — alle State-Updates laufen im Timeout-Callback (nicht synchron im Effekt).
  useEffect(() => {
    if (picked || query.trim().length < 1) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (cancelled) return;
        setConfigured(data.configured ?? true);
        setResults(data.results ?? []);
        setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, picked]);

  // Klick außerhalb schließt Dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(hit: ApiHit) {
    setPicked(hit);
    setOpen(false);
    setQuery("");
    onCurrency?.(hit.currency);
  }

  function clearPick() {
    setPicked(null);
    setManual(false);
    onCurrency?.(null);
  }

  if (picked) {
    return (
      <div key="picked" className="space-y-1">
        <Label>{label ?? "Instrument"}</Label>
        <div className="flex items-center justify-between rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-2">
          <div>
            <span className="font-medium">{picked.symbol}</span>
            {!symbolOnly && <span className="ml-2 text-sm text-zinc-400">{picked.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {!symbolOnly && (
              <>
                <Badge color={instrumentTypeLabel(picked.type).color}>
                  {instrumentTypeLabel(picked.type).label}
                </Badge>
                <Badge color="zinc">{picked.exchange}</Badge>
                <Badge color="zinc">{picked.currency}</Badge>
              </>
            )}
            <button
              type="button"
              onClick={clearPick}
              className="text-sm text-zinc-400 hover:text-red-400"
            >
              ändern
            </button>
          </div>
        </div>
        <input type="hidden" name={fieldName} value={picked.symbol} />
        {!symbolOnly && (
          <>
            <input type="hidden" name="exchange" value={picked.exchange} />
            <input type="hidden" name="name" value={picked.name} />
            <input type="hidden" name="currency" value={picked.currency} />
            <input type="hidden" name="instrType" value={picked.type} />
            <input type="hidden" name="mic" value={picked.mic ?? ""} />
          </>
        )}
      </div>
    );
  }

  if (manual && symbolOnly) {
    return (
      <div key="manual" className="space-y-1">
        <Label>{label ?? "Symbol"} (manuell)</Label>
        <Input name={fieldName} placeholder="Symbol z.B. ALV" autoComplete="off" required />
        <button
          type="button"
          onClick={() => setManual(false)}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← zur Suche
        </button>
      </div>
    );
  }

  if (manual) {
    return (
      <div key="manual" className="space-y-2">
        <Label>Instrument (manuell)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input name="symbol" placeholder="Symbol z.B. ALV" required />
          <Input name="exchange" placeholder="Börse z.B. XETRA" required />
          <Input name="name" placeholder="Name" />
          <Select
            name="currency"
            defaultValue={defaultCurrency}
            onChange={(e) => onCurrency?.(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <input type="hidden" name="instrType" value="STOCK" />
        <input type="hidden" name="mic" value="" />
        <button
          type="button"
          onClick={() => setManual(false)}
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← zur Suche
        </button>
      </div>
    );
  }

  return (
    <div key="search" className="space-y-1" ref={boxRef}>
      <Label htmlFor="ticker-search">{label ?? "Instrument (Ticker, Name oder ISIN)"}</Label>
      <div className="relative">
        <Input
          id="ticker-search"
          autoComplete="off"
          placeholder="z.B. AAPL, Apple oder US0378331005"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (v.trim().length < 1) {
              setResults([]);
              setOpen(false);
            }
          }}
          onFocus={() => results.length && setOpen(true)}
        />
        {open && (results.length > 0 || loading) && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-lg">
            {loading && <li className="px-3 py-2 text-sm text-zinc-500">Suche…</li>}
            {results.map((hit, i) => (
              <li key={`${hit.symbol}-${hit.exchange}-${i}`}>
                <button
                  type="button"
                  onClick={() => choose(hit)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-800",
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Badge color={instrumentTypeLabel(hit.type).color}>
                      {instrumentTypeLabel(hit.type).label}
                    </Badge>
                    <span className="font-medium">{hit.symbol}</span>
                    <span className="truncate text-zinc-400">{hit.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {hit.exchange} · {hit.currency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-amber-400/80">
          {!configured && "Kein Twelve-Data-Key — nutze die manuelle Eingabe."}
        </span>
        <button
          type="button"
          onClick={() => {
            setManual(true);
            onCurrency?.(defaultCurrency);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Manuell eingeben
        </button>
      </div>
    </div>
  );
}
