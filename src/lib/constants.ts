export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD", "JPY", "AUD"] as const;

export const OPTION_MULTIPLIER = 100;

export type BadgeColor = "zinc" | "green" | "red" | "amber" | "blue";

/** Anzeige-Label + Farbe für den Instrument-Typ. */
export function instrumentTypeLabel(type: string): { label: string; color: BadgeColor } {
  switch (type) {
    case "ETF":
      return { label: "ETF", color: "blue" };
    case "FUND":
      return { label: "Fonds", color: "amber" };
    case "INDEX":
      return { label: "Index", color: "green" };
    case "STOCK":
      return { label: "Aktie", color: "zinc" };
    default:
      return { label: "Sonstige", color: "zinc" };
  }
}
