/**
 * Seed-Daten + Session für UI-Smoke-Test / manuelles Ausprobieren.
 * Lauf: node --conditions=react-server --import tsx scripts/seed-session.mts
 * Gibt den Session-Cookie-Token auf stdout aus.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { applyStockTrade, openOption, rollOption } from "@/lib/positions";

const TYPE = "STOCK" as const;

async function main() {
  const email = "demo@test.local";
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: { email, passwordHash: "x", name: "Demo", role: "ADMIN", emailVerified: new Date() },
  });
  const account = await prisma.account.create({
    data: { userId: user.id, name: "IBKR Demo", baseCurrency: "USD", broker: "IBKR" },
  });
  const acc = account.id;

  await applyStockTrade({
    accountId: acc,
    instrument: { symbol: "AAPL", exchange: "NASDAQ", name: "Apple Inc", currency: "USD", type: TYPE, mic: "XNGS" },
    side: "BUY", qty: 100, price: 180, fees: 1, tradeDate: new Date("2026-05-01"),
  });

  await openOption({
    accountId: acc,
    instrument: { symbol: "AAPL", exchange: "NASDAQ", name: "Apple Inc", currency: "USD", type: TYPE, mic: "XNGS" },
    direction: "SHORT", right: "CALL", strike: 200, expiry: new Date("2026-06-19"),
    contracts: 1, premium: 2.5, fees: 0.65, tradeDate: new Date("2026-05-10"),
  });
  const sc = await prisma.position.findFirstOrThrow({
    where: { accountId: acc, kind: "OPTION", status: "OPEN" },
  });
  await rollOption({
    positionId: sc.id, closePremium: 3.2, newStrike: 205, newExpiry: new Date("2026-07-17"),
    newPremium: 2.9, fees: 0.65, tradeDate: new Date("2026-06-15"),
  });

  // Session
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      pending2fa: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  console.log(token);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
