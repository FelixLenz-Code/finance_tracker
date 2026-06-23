import { z } from "zod";

// Austauschformat für ein komplettes Depot (Account + Instrumente + Positionen
// inkl. Roll-Ketten + Transaktionen + Cash-Buchungen). Verlustfrei round-trip-fähig:
// Decimals werden als Strings serialisiert, Datumswerte als ISO-Strings, und die
// Beziehungen laufen über interne `ref`-Schlüssel (die Original-IDs des Exports),
// die beim Import auf frische IDs umgemappt werden.

export const DEPOT_FORMAT = "trade-tracker/depot";
export const DEPOT_FORMAT_VERSION = 1;

const decimalStr = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)), "Ungültige Zahl");

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Ungültiges Datum");

const instrumentSchema = z.object({
  ref: z.string(),
  symbol: z.string().min(1),
  exchange: z.string(),
  mic: z.string().nullish(),
  name: z.string(),
  type: z.enum(["STOCK", "ETF", "INDEX", "FUND", "OTHER"]).default("STOCK"),
  currency: z.string().default("USD"),
  isin: z.string().nullish(),
  country: z.string().nullish(),
});

const positionSchema = z.object({
  ref: z.string(),
  instrumentRef: z.string(),
  kind: z.enum(["STOCK", "OPTION"]),
  direction: z.enum(["LONG", "SHORT"]),
  status: z.enum(["OPEN", "CLOSED", "ROLLED", "ASSIGNED", "EXPIRED"]),
  openedAt: isoDate,
  closedAt: isoDate.nullish(),
  qty: decimalStr,
  avgOpenPrice: decimalStr,
  realizedPnl: decimalStr,
  currency: z.string(),
  optionRight: z.enum(["CALL", "PUT"]).nullish(),
  strike: decimalStr.nullish(),
  expiry: isoDate.nullish(),
  multiplier: z.number().int().nullish(),
  chainRef: z.string().nullish(),
  prevPositionRef: z.string().nullish(),
});

const transactionSchema = z.object({
  positionRef: z.string().nullish(),
  type: z.enum([
    "BUY", "SELL", "SELL_TO_OPEN", "BUY_TO_CLOSE", "BUY_TO_OPEN",
    "SELL_TO_CLOSE", "ASSIGNMENT", "EXPIRATION", "DIVIDEND", "FEE",
  ]),
  tradeDate: isoDate,
  qty: decimalStr,
  price: decimalStr,
  fees: decimalStr.default("0"),
  commission: decimalStr.default("0"),
  currency: z.string(),
  notes: z.string().nullish(),
});

const cashTxnSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "DIVIDEND", "EXCHANGE"]),
  amount: decimalStr,
  currency: z.string(),
  date: isoDate,
  symbol: z.string().nullish(),
  note: z.string().nullish(),
  toCurrency: z.string().nullish(),
  toAmount: decimalStr.nullish(),
});

export const depotExportSchema = z.object({
  format: z.literal(DEPOT_FORMAT),
  version: z.number(),
  exportedAt: z.string().optional(),
  account: z.object({
    name: z.string().trim().min(1, "Name erforderlich").max(80),
    broker: z.string().nullish(),
    baseCurrency: z.string().trim().length(3, "3-Buchstaben-Code").toUpperCase(),
    currencies: z.array(z.string()).default([]),
  }),
  instruments: z.array(instrumentSchema),
  positions: z.array(positionSchema),
  transactions: z.array(transactionSchema),
  cashTransactions: z.array(cashTxnSchema),
});

export type DepotExport = z.infer<typeof depotExportSchema>;
