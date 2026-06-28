"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts";
import { Button, cn } from "@/components/ui";
import { money, pnlClass } from "@/lib/format";

type Point = { date: string; pnl: number };

const RANGES = [
  { key: "3M", label: "3M", months: 3 },
  { key: "6M", label: "6M", months: 6 },
  { key: "12M", label: "12M", months: 12 },
  { key: "YTD", label: "YTD", months: 0 },
  { key: "ALL", label: "Alles", months: -1 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/** Untergrenze (ISO-Datum, inkl.) für einen Zeitraum. */
function rangeStart(key: RangeKey): string | null {
  const now = new Date();
  if (key === "ALL") return null;
  if (key === "YTD") return `${now.getFullYear()}-01-01`;
  const months = RANGES.find((r) => r.key === key)!.months;
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Kumulierte Equity-Kurve des realisierten G&V (Hauptwährung) mit Zeitraumwahl.
 * Summiert die geschlossenen Positionen chronologisch auf.
 */
export function RealizedPnlChart({ points, currency }: { points: Point[]; currency: string }) {
  const [range, setRange] = useState<RangeKey>("12M");

  const { series, total } = useMemo(() => {
    const start = rangeStart(range);
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    let sum = 0;
    const series: { label: string; value: number }[] = [];
    for (const p of sorted) {
      const day = p.date.slice(0, 10);
      if (start && day < start) continue;
      sum += p.pnl;
      series.push({ label: fmtShort(day), value: sum });
    }
    return { series, total: sum };
  }, [points, range]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              type="button"
              variant={range === r.key ? "secondary" : "ghost"}
              onClick={() => setRange(r.key)}
              className={cn("px-3 py-1 text-xs", range === r.key && "ring-emerald-500/40")}
            >
              {r.label}
            </Button>
          ))}
        </div>
        {series.length > 0 && (
          <span className="ml-auto text-sm">
            <span className="text-zinc-500">Summe: </span>
            <span className={cn("font-semibold tabular-nums", pnlClass(total))}>{money(total, currency)}</span>
          </span>
        )}
      </div>
      {series.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">Keine geschlossenen Positionen in diesem Zeitraum.</p>
      ) : (
        <LineChart points={series} />
      )}
    </div>
  );
}

/** "YYYY-MM-DD" → "DD.MM." für kompakte Achsenbeschriftung. */
function fmtShort(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}.${m}.`;
}
