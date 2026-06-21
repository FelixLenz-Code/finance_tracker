"use client";

import { useState } from "react";
import { Label, Select, cn } from "@/components/ui";
import { CURRENCIES } from "@/lib/constants";

/** Basiswährung (Select) + Mehrfachauswahl der im Konto geführten Währungen. */
export function CurrencyFields({
  defaultBase = "USD",
  defaultCurrencies = [],
}: {
  defaultBase?: string;
  defaultCurrencies?: string[];
}) {
  const [base, setBase] = useState(defaultBase);
  const [extra, setExtra] = useState<Set<string>>(
    new Set(defaultCurrencies.filter((c) => c !== defaultBase)),
  );

  return (
    <div className="space-y-2">
      <div className="w-36">
        <Label>Basiswährung</Label>
        <Select name="baseCurrency" value={base} onChange={(e) => setBase(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Geführte Währungen</Label>
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map((c) => {
            const checked = c === base || extra.has(c);
            return (
              <label
                key={c}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                  checked
                    ? "bg-emerald-600/20 text-emerald-300 ring-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 ring-transparent hover:bg-zinc-700",
                  c === base && "opacity-100",
                )}
              >
                <input
                  type="checkbox"
                  name="currencies"
                  value={c}
                  checked={checked}
                  disabled={c === base}
                  onChange={() =>
                    setExtra((prev) => {
                      const n = new Set(prev);
                      if (n.has(c)) n.delete(c);
                      else n.add(c);
                      return n;
                    })
                  }
                  className="sr-only"
                />
                {c}
                {c === base && " ·"}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Basiswährung ist immer enthalten (·). Weitere anklicken für Multi-Währungs-Depots.
        </p>
      </div>
    </div>
  );
}
