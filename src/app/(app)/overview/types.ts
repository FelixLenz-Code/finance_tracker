export type Leg = {
  id: string;
  status: string;
  direction: string;
  optionRight: string | null;
  strike: number | null;
  expiry: string | null;
  qty: number;
  avgOpenPrice: number;
  realizedPnl: number;
  openedAt: string;
  closedAt: string | null;
};

export type TxnLite = {
  id: string;
  type: string;
  qty: number;
  price: number;
  fees: number;
  tradeDate: string;
  currency: string;
  note: string | null;
};

export type Row = {
  id: string; // Head-Position
  kind: "STOCK" | "OPTION";
  accountId: string;
  accountName: string;
  baseCurrency: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  direction: string;
  status: string;
  optionRight: string | null;
  strike: number | null;
  expiry: string | null;
  qty: number;
  avgOpenPrice: number;
  realizedPnl: number; // bei Optionen: Summe über die Kette
  openedAt: string;
  closedAt: string | null;
  isChain: boolean;
  legs: Leg[];
  transactions: TxnLite[]; // alle Transaktionen (über die Kette), chronologisch
  hasNotes: boolean;
};
