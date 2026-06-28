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

/**
 * Linien-/Flächendiagramm (SVG) für einen Verlauf über die Zeit. Skaliert per
 * viewBox auf die Containerbreite; Höhe fix. Zeichnet eine Null-Basislinie (sofern
 * im Wertebereich), eine sanfte Flächenfüllung und den Endwert als Punkt + Label.
 * Farbe richtet sich nach dem Endwert (grün/rot/neutral).
 */
export function LineChart({
  points,
  height = 180,
}: {
  points: { label: string; value: number }[];
  height?: number;
}) {
  if (points.length === 0) return <p className="text-sm text-zinc-500">Keine Daten.</p>;

  const W = 600;
  const H = height;
  const padX = 8;
  const padTop = 16;
  const padBottom = 22;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const values = points.map((p) => p.value);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) {
    // Flache Linie: künstlichen Spielraum schaffen, damit etwas sichtbar ist.
    max = max + 1;
    min = min - 1;
  }
  const span = max - min;

  // Bei nur einem Punkt eine waagerechte Linie über die Breite zeichnen.
  const xAt = (i: number) => padX + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => padTop + (1 - (v - min) / span) * plotH;

  const last = points[points.length - 1].value;
  const stroke = last > 0 ? "#10b981" : last < 0 ? "#f43f5e" : "#a1a1aa";
  const gid = `lc-${last > 0 ? "pos" : last < 0 ? "neg" : "neu"}`;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(" ");
  const yZero = yAt(0);
  const area =
    points.length === 1
      ? `M ${padX} ${yAt(last).toFixed(1)} L ${W - padX} ${yAt(last).toFixed(1)} L ${W - padX} ${yZero.toFixed(1)} L ${padX} ${yZero.toFixed(1)} Z`
      : `${line} L ${xAt(points.length - 1).toFixed(1)} ${yZero.toFixed(1)} L ${xAt(0).toFixed(1)} ${yZero.toFixed(1)} Z`;

  // Bis zu 5 X-Achsen-Labels gleichmäßig verteilt (erstes/letztes immer dabei).
  const maxLabels = 5;
  const step = points.length <= maxLabels ? 1 : Math.ceil((points.length - 1) / (maxLabels - 1));
  const tickIdx = points.length === 1 ? [0] : [...new Set([...Array.from({ length: points.length }, (_, i) => i).filter((i) => i % step === 0), points.length - 1])];

  const zeroVisible = min < 0 && max > 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {zeroVisible && (
          <line x1={padX} y1={yZero} x2={W - padX} y2={yZero} stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 3" />
        )}
        <path d={area} fill={`url(#${gid})`} stroke="none" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={xAt(points.length - 1)} cy={yAt(last)} r="3.5" fill={stroke} />
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-zinc-500">
        {tickIdx.map((i) => (
          <span key={i}>{points[i].label}</span>
        ))}
      </div>
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
