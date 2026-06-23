import "server-only";
import { prisma } from "@/lib/db";
import type { DepotExport } from "@/lib/depot-transfer";

/**
 * Legt aus einem geparsten Depot-Export ein NEUES Konto für `userId` an.
 * Instrumente werden global per (symbol, exchange) aufgelöst/erzeugt; alle
 * übrigen IDs (Positionen, Roll-Ketten, Transaktionen) werden auf frische IDs
 * umgemappt. Läuft komplett in einer Transaktion (alles-oder-nichts).
 * Gibt die ID des neuen Kontos zurück.
 */
export async function importDepot(userId: string, data: DepotExport): Promise<string> {
  const baseCurrency = data.account.baseCurrency;
  const currencies = Array.from(
    new Set([baseCurrency, ...data.account.currencies.map((c) => c.toUpperCase())]),
  );

  return prisma.$transaction(
    async (tx) => {
      const account = await tx.account.create({
        data: {
          userId,
          name: data.account.name,
          broker: data.account.broker || null,
          baseCurrency,
          currencies,
        },
      });

      // Instrumente global auflösen (vorhandene wiederverwenden, sonst anlegen).
      const instrumentId = new Map<string, string>();
      for (const i of data.instruments) {
        const inst = await tx.instrument.upsert({
          where: { symbol_exchange: { symbol: i.symbol, exchange: i.exchange } },
          create: {
            symbol: i.symbol,
            exchange: i.exchange,
            mic: i.mic ?? null,
            name: i.name,
            type: i.type,
            currency: i.currency,
            isin: i.isin ?? null,
            country: i.country ?? null,
          },
          update: {},
        });
        instrumentId.set(i.ref, inst.id);
      }

      // Positionen anlegen (ohne prevPositionId), IDs/Chains ummappen.
      const positionId = new Map<string, string>();
      const chainId = new Map<string, string>();
      for (const p of data.positions) {
        const instId = instrumentId.get(p.instrumentRef);
        if (!instId) throw new Error(`Instrument-Referenz „${p.instrumentRef}" fehlt.`);
        let chain: string | null = null;
        if (p.chainRef) {
          chain = chainId.get(p.chainRef) ?? crypto.randomUUID();
          chainId.set(p.chainRef, chain);
        }
        const created = await tx.position.create({
          data: {
            accountId: account.id,
            instrumentId: instId,
            kind: p.kind,
            direction: p.direction,
            status: p.status,
            openedAt: new Date(p.openedAt),
            closedAt: p.closedAt ? new Date(p.closedAt) : null,
            qty: p.qty,
            avgOpenPrice: p.avgOpenPrice,
            realizedPnl: p.realizedPnl,
            currency: p.currency,
            optionRight: p.optionRight ?? null,
            strike: p.strike ?? null,
            expiry: p.expiry ? new Date(p.expiry) : null,
            multiplier: p.multiplier ?? null,
            chainId: chain,
          },
        });
        positionId.set(p.ref, created.id);
      }

      // Roll-Verkettung (prevPositionId) nachziehen.
      for (const p of data.positions) {
        if (!p.prevPositionRef) continue;
        const id = positionId.get(p.ref);
        const prevId = positionId.get(p.prevPositionRef);
        if (id && prevId) {
          await tx.position.update({ where: { id }, data: { prevPositionId: prevId } });
        }
      }

      // Transaktionen.
      for (const t of data.transactions) {
        await tx.transaction.create({
          data: {
            accountId: account.id,
            positionId: t.positionRef ? positionId.get(t.positionRef) ?? null : null,
            type: t.type,
            tradeDate: new Date(t.tradeDate),
            qty: t.qty,
            price: t.price,
            fees: t.fees,
            commission: t.commission,
            currency: t.currency,
            notes: t.notes ?? null,
          },
        });
      }

      // Cash-Buchungen.
      for (const c of data.cashTransactions) {
        await tx.cashTransaction.create({
          data: {
            accountId: account.id,
            type: c.type,
            amount: c.amount,
            currency: c.currency,
            date: new Date(c.date),
            symbol: c.symbol ?? null,
            note: c.note ?? null,
            toCurrency: c.toCurrency ?? null,
            toAmount: c.toAmount ?? null,
          },
        });
      }

      return account.id;
    },
    { timeout: 30000 },
  );
}
