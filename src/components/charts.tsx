import { cn } from "@/components/ui";

export const CHART_COLORS = [
  "#10b981", "#3b82f6", "#a855f7", "#f59e0b",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316",
];

/** Donut-/Kuchendiagramm (SVG) mit Legende. */
export function Donut({
  segments,
  format,
  size = 150,
  thickness = 22,
}: {
  segments: { label: string; value: number; color: string }[];
  format: (n: number) => string;
  size?: number;
  thickness?: number;
}) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <p className="text-sm text-zinc-500">Keine Daten.</p>;

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  // Offsets mutationsfrei vorberechnen.
  const arcs = visible.map((s, i) => {
    const prior = visible.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    return { ...s, dash: (s.value / total) * c, offset: (prior / total) * c };
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((s, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${s.dash} ${c - s.dash}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
      </svg>
      <div className="space-y-1.5">
        {visible.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-zinc-400">{s.label}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-zinc-200">
              {format(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontale Balken; unterstützt negative Werte (rot) und positive (grün). */
export function HBars({
  data,
  format,
}: {
  data: { label: string; value: number }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  if (data.length === 0) {
    return <p className="text-sm text-zinc-500">Keine Daten.</p>;
  }
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs text-zinc-400">{d.label}</span>
          <div className="relative h-4 flex-1 rounded bg-zinc-800/70">
            <div
              className={cn("h-4 rounded", d.value >= 0 ? "bg-emerald-500/80" : "bg-red-500/80")}
              style={{ width: `${(Math.abs(d.value) / max) * 100}%` }}
            />
          </div>
          <span
            className={cn(
              "w-24 shrink-0 text-right text-xs font-medium tabular-nums",
              d.value > 0 ? "text-emerald-400" : d.value < 0 ? "text-red-400" : "text-zinc-400",
            )}
          >
            {format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Horizontaler Stacked-Bar für eine Aufteilung (Allokation). */
export function StackedBar({
  segments,
  format,
}: {
  segments: { label: string; value: number; color: string }[];
  format: (n: number) => string;
}) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <p className="text-sm text-zinc-500">Keine Daten.</p>;
  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-800">
        {visible.map((s, i) => (
          <div key={i} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${format(s.value)}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {visible.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className={cn("h-2.5 w-2.5 rounded-sm", s.color)} />
            <span className="text-zinc-400">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums text-zinc-200">{format(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
