import { ImageResponse } from "next/og";

/**
 * Erzeugt das App-Icon (Balken-Chart auf Emerald-Verlauf) als PNG via Satori.
 * `maskable` = ohne Eckenrundung und mit mehr Rand (Android-Safe-Zone).
 */
export function iconResponse(size: number, opts?: { maskable?: boolean }) {
  const maskable = opts?.maskable ?? false;
  const pad = Math.round(size * (maskable ? 0.2 : 0.16));
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const barRadius = Math.max(2, Math.round(size * 0.05));
  const bars = ["44%", "68%", "92%"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          boxSizing: "border-box",
          padding: pad,
          borderRadius: radius,
          backgroundImage: "linear-gradient(135deg, #34d399 0%, #0f766e 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          {bars.map((h) => (
            <div
              key={h}
              style={{ width: "24%", height: h, borderRadius: barRadius, backgroundColor: "#ffffff" }}
            />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
