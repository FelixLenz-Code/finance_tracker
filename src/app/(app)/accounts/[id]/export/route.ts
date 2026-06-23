import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEPOT_FORMAT, DEPOT_FORMAT_VERSION, type DepotExport } from "@/lib/depot-transfer";

const dec = (v: { toString(): string } | null | undefined) => (v == null ? null : v.toString());
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "depot";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const account = await prisma.account.findFirst({
    where: { id, userId: user.id },
    include: {
      positions: { include: { instrument: true }, orderBy: { openedAt: "asc" } },
      transactions: { orderBy: { tradeDate: "asc" } },
      cashTransactions: { orderBy: { date: "asc" } },
    },
  });
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Instrumente deduplizieren (mehrere Positionen teilen sich ein Instrument).
  const instruments = new Map<string, (typeof account.positions)[number]["instrument"]>();
  for (const p of account.positions) instruments.set(p.instrument.id, p.instrument);

  const data: DepotExport = {
    format: DEPOT_FORMAT,
    version: DEPOT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      name: account.name,
      broker: account.broker,
      baseCurrency: account.baseCurrency,
      currencies: account.currencies,
    },
    instruments: [...instruments.values()].map((i) => ({
      ref: i.id,
      symbol: i.symbol,
      exchange: i.exchange,
      mic: i.mic,
      name: i.name,
      type: i.type,
      currency: i.currency,
      isin: i.isin,
      country: i.country,
    })),
    positions: account.positions.map((p) => ({
      ref: p.id,
      instrumentRef: p.instrumentId,
      kind: p.kind,
      direction: p.direction,
      status: p.status,
      openedAt: p.openedAt.toISOString(),
      closedAt: iso(p.closedAt),
      qty: dec(p.qty)!,
      avgOpenPrice: dec(p.avgOpenPrice)!,
      realizedPnl: dec(p.realizedPnl)!,
      currency: p.currency,
      optionRight: p.optionRight,
      strike: dec(p.strike),
      expiry: iso(p.expiry),
      multiplier: p.multiplier,
      chainRef: p.chainId,
      prevPositionRef: p.prevPositionId,
    })),
    transactions: account.transactions.map((t) => ({
      positionRef: t.positionId,
      type: t.type,
      tradeDate: t.tradeDate.toISOString(),
      qty: dec(t.qty)!,
      price: dec(t.price)!,
      fees: dec(t.fees)!,
      commission: dec(t.commission)!,
      currency: t.currency,
      notes: t.notes,
    })),
    cashTransactions: account.cashTransactions.map((c) => ({
      type: c.type,
      amount: dec(c.amount)!,
      currency: c.currency,
      date: c.date.toISOString(),
      symbol: c.symbol,
      note: c.note,
      toCurrency: c.toCurrency,
      toAmount: dec(c.toAmount),
    })),
  };

  const filename = `depot-${slug(account.name)}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
