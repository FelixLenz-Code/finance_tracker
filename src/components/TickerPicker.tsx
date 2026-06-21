"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Label, Select, Badge, cn } from "@/components/ui";
import { CURRENCIES } from "@/lib/constants";

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

export function TickerPicker({ defaultCurrency = "USD" }: { defaultCurrency?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [picked, setPicked] = useState<Picked | null>(null);
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
  }

  function clearPick() {
    setPicked(null);
    setManual(false);
  }

  if (picked) {
    return (
      <div key="picked" className="space-y-1">
        <Label>Instrument</Label>
        <div className="flex items-center justify-between rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-2">
          <div>
            <span className="font-medium">{picked.symbol}</span>
            <span className="ml-2 text-sm text-zinc-400">{picked.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge color="zinc">{picked.exchange}</Badge>
            <Badge color="blue">{picked.currency}</Badge>
            <button
              type="button"
              onClick={clearPick}
              className="text-sm text-zinc-400 hover:text-red-400"
            >
              ändern
            </button>
          </div>
        </div>
        <input type="hidden" name="symbol" value={picked.symbol} />
        <input type="hidden" name="exchange" value={picked.exchange} />
        <input type="hidden" name="name" value={picked.name} />
        <input type="hidden" name="currency" value={picked.currency} />
        <input type="hidden" name="instrType" value={picked.type} />
        <input type="hidden" name="mic" value={picked.mic ?? ""} />
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
          <Select name="currency" defaultValue={defaultCurrency}>
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
      <Label htmlFor="ticker-search">Instrument (Ticker eingeben)</Label>
      <div className="relative">
        <Input
          id="ticker-search"
          autoComplete="off"
          placeholder="z.B. AAPL oder SAP"
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
                  <span>
                    <span className="font-medium">{hit.symbol}</span>
                    <span className="ml-2 text-zinc-400">{hit.name}</span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {hit.exchange} · {hit.currency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{!configured && "Kein Twelve-Data-Key — bitte manuell eingeben."}</span>
        <button
          type="button"
          onClick={() => setManual(true)}
          className="hover:text-zinc-300"
        >
          manuell eingeben
        </button>
      </div>
    </div>
  );
}
