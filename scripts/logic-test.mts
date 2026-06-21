/**
 * End-to-End-Test der Positions-/P&L-Logik gegen die echte DB.
 * Lauf: node --conditions=react-server --import tsx scripts/logic-test.mts
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { prisma } from "@/lib/db";
import {
  applyStockTrade,
  openOption,
  rollOption,
  closeOption,
  expireOption,
  assignOption,
} from "@/lib/positions";
import { toNum } from "@/lib/format";

const TYPE = "STOCK" as const;
const instr = (symbol: string) => ({
  symbol,
  exchange: "TEST",
  name: `${symbol} Test`,
  currency: "USD",
  type: TYPE,
  mic: null,
});

let pass = 0;
let fail = 0;
function check(label: string, got: number, want: number, tol = 0.001) {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? "✓" : "✗"} ${label}: got=${got} want=${want}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  const user = await prisma.user.create({
    data: { email: `logic-${Date.now()}@test.local`, passwordHash: "x", name: "Logic" },
  });
  const account = await prisma.account.create({
    data: { userId: user.id, name: "Test", baseCurrency: "USD" },
  });
  const acc = account.id;
  const d = (s: string) => new Date(s);

  // --- Aktien: Kauf 10@100, Kauf 10@120 (avg 110), Verkauf 10@130 ---
  await applyStockTrade({ accountId: acc, instrument: instr("AAA"), side: "BUY", qty: 10, price: 100, fees: 0, tradeDate: d("2026-01-01") });
  await applyStockTrade({ accountId: acc, instrument: instr("AAA"), side: "BUY", qty: 10, price: 120, fees: 0, tradeDate: d("2026-01-02") });
  await applyStockTrade({ accountId: acc, instrument: instr("AAA"), side: "SELL", qty: 10, price: 130, fees: 0, tradeDate: d("2026-01-03") });
  const aaa = await prisma.position.findFirstOrThrow({ where: { accountId: acc, instrument: { symbol: "AAA" }, status: "OPEN" } });
  check("Aktie avg nach 2 Käufen", toNum(aaa.avgOpenPrice), 110);
  check("Aktie Restmenge", toNum(aaa.qty), 10);
  check("Aktie realisierter P&L (130-110)*10", toNum(aaa.realizedPnl), 200);

  // --- Short Put eröffnen: 2 Kontrakte, Prämie 3.00 -> Buyback 1.00 ---
  await openOption({ accountId: acc, instrument: { ...instr("BBB"), type: "STOCK" }, direction: "SHORT", right: "PUT", strike: 90, expiry: d("2026-03-20"), contracts: 2, premium: 3, fees: 0, tradeDate: d("2026-01-05") });
  const sp = await prisma.position.findFirstOrThrow({ where: { accountId: acc, instrument: { symbol: "BBB" }, status: "OPEN" } });
  await closeOption({ positionId: sp.id, closePremium: 1, fees: 0, tradeDate: d("2026-01-10") });
  const spClosed = await prisma.position.findUniqueOrThrow({ where: { id: sp.id } });
  check("Short Put close P&L (3-1)*2*100", toNum(spClosed.realizedPnl), 400);
  check("Short Put status", spClosed.status === "CLOSED" ? 1 : 0, 1);

  // --- Rollen: Short Call STO Prämie 2.00, Buyback 3.00 (-100), neu Prämie 2.50 ---
  await openOption({ accountId: acc, instrument: { ...instr("CCC"), type: "STOCK" }, direction: "SHORT", right: "CALL", strike: 100, expiry: d("2026-02-20"), contracts: 1, premium: 2, fees: 0, tradeDate: d("2026-01-06") });
  const sc = await prisma.position.findFirstOrThrow({ where: { accountId: acc, instrument: { symbol: "CCC" }, status: "OPEN" } });
  await rollOption({ positionId: sc.id, closePremium: 3, newStrike: 105, newExpiry: d("2026-03-20"), newPremium: 2.5, fees: 0, tradeDate: d("2026-02-01") });
  const scOld = await prisma.position.findUniqueOrThrow({ where: { id: sc.id } });
  check("Roll alte Position P&L (2-3)*1*100", toNum(scOld.realizedPnl), -100);
  check("Roll alte Position status ROLLED", scOld.status === "ROLLED" ? 1 : 0, 1);
  const scNew = await prisma.position.findFirstOrThrow({ where: { prevPositionId: sc.id } });
  check("Roll neue Position gleiche chainId", scNew.chainId === (scOld.chainId ?? scOld.id) ? 1 : 0, 1);
  check("Roll neue Position Strike", toNum(scNew.strike), 105);
  // neue schließen wertlos
  await expireOption({ positionId: scNew.id, tradeDate: d("2026-03-20") });
  const scNewExp = await prisma.position.findUniqueOrThrow({ where: { id: scNew.id } });
  check("Neue Position Verfall behält Prämie 2.5*1*100", toNum(scNewExp.realizedPnl), 250);
  // Chain-Summe = -100 + 250 = 150
  const chain = await prisma.position.findMany({ where: { chainId: scOld.chainId ?? scOld.id } });
  const chainSum = chain.reduce((s, p) => s + toNum(p.realizedPnl), 0);
  check("Roll-Kette Gesamt-P&L", chainSum, 150);

  // --- Andienung: Short Put DDD Strike 50, Prämie 1.5, 1 Kontrakt -> Aktien-Leg BUY 100@50 ---
  await openOption({ accountId: acc, instrument: { ...instr("DDD"), type: "STOCK" }, direction: "SHORT", right: "PUT", strike: 50, expiry: d("2026-02-20"), contracts: 1, premium: 1.5, fees: 0, tradeDate: d("2026-01-07") });
  const dp = await prisma.position.findFirstOrThrow({ where: { accountId: acc, instrument: { symbol: "DDD" }, status: "OPEN" } });
  await assignOption({ positionId: dp.id, tradeDate: d("2026-02-20") });
  const dpA = await prisma.position.findUniqueOrThrow({ where: { id: dp.id } });
  check("Andienung Short Put behält Prämie 1.5*1*100", toNum(dpA.realizedPnl), 150);
  check("Andienung status ASSIGNED", dpA.status === "ASSIGNED" ? 1 : 0, 1);
  const ddStock = await prisma.position.findFirstOrThrow({ where: { accountId: acc, instrument: { symbol: "DDD" }, kind: "STOCK" } });
  check("Andienung Aktien-Leg Menge 100", toNum(ddStock.qty), 100);
  check("Andienung Aktien-Leg Kurs = Strike 50", toNum(ddStock.avgOpenPrice), 50);
  check("Andienung Aktien-Leg LONG", ddStock.direction === "LONG" ? 1 : 0, 1);

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
