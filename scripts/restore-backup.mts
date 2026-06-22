// Spielt einen vollständigen Snapshot (von runBackup / `npm run backup`) zurück in die DB.
// Erwartet eine LEERE Ziel-DB (IDs werden 1:1 übernommen). Alles-oder-nichts in einer Transaktion.
//
//   npm run restore -- pfad/zum/tracker-backup-….json.gz --yes
//
// Falls die Datei verschlüsselt im rclone-crypt-Remote liegt, vorher entschlüsselt laden:
//   rclone --config <conf> cat crypt:pfad/datei.json.gz > /tmp/backup.json.gz
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { prisma } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */
const D = (v: any): Date | null => (v == null ? null : new Date(v));

async function main() {
  const file = process.argv[2];
  const yes = process.argv.includes("--yes");
  if (!file) {
    console.error("Usage: npm run restore -- <snapshot.json[.gz]> --yes");
    process.exit(1);
  }

  const raw = await readFile(file);
  const text = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const snap = JSON.parse(text);
  if (snap?.format !== "trade-tracker/full-backup") {
    console.error("Kein gültiges Backup (format ≠ trade-tracker/full-backup).");
    process.exit(1);
  }
  const d = snap.data ?? {};
  console.log(`Snapshot vom ${snap.createdAt}:`, JSON.stringify({
    users: d.users?.length ?? 0,
    accounts: d.accounts?.length ?? 0,
    positions: d.positions?.length ?? 0,
    transactions: d.transactions?.length ?? 0,
    cashTransactions: d.cashTransactions?.length ?? 0,
    instruments: d.instruments?.length ?? 0,
  }));

  const existing = await prisma.user.count();
  if (existing > 0) {
    console.error(`\n⚠ Die Ziel-DB enthält bereits ${existing} Nutzer. Der Restore übernimmt die`);
    console.error("  Original-IDs und bricht bei Konflikten ab. Nur in eine LEERE DB einspielen.");
    process.exit(1);
  }
  if (!yes) {
    console.error("\nZum Ausführen --yes anhängen.");
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    if (d.users?.length)
      await tx.user.createMany({ data: d.users.map((u: any) => ({ ...u, emailVerified: D(u.emailVerified), createdAt: D(u.createdAt), updatedAt: D(u.updatedAt) })) });
    if (d.backupCodes?.length)
      await tx.backupCode.createMany({ data: d.backupCodes.map((b: any) => ({ ...b, usedAt: D(b.usedAt) })) });
    if (d.instruments?.length)
      await tx.instrument.createMany({ data: d.instruments.map((i: any) => ({ ...i, createdAt: D(i.createdAt), updatedAt: D(i.updatedAt) })) });
    if (d.accounts?.length)
      await tx.account.createMany({ data: d.accounts.map((a: any) => ({ ...a, createdAt: D(a.createdAt), updatedAt: D(a.updatedAt) })) });
    // Positionen ohne Selbst-FK anlegen …
    if (d.positions?.length)
      await tx.position.createMany({ data: d.positions.map((p: any) => ({ ...p, prevPositionId: null, openedAt: D(p.openedAt), closedAt: D(p.closedAt), expiry: D(p.expiry) })) });
    // … dann Roll-Verkettung nachziehen.
    for (const p of d.positions ?? []) {
      if (p.prevPositionId) await tx.position.update({ where: { id: p.id }, data: { prevPositionId: p.prevPositionId } });
    }
    if (d.transactions?.length)
      await tx.transaction.createMany({ data: d.transactions.map((t: any) => ({ ...t, tradeDate: D(t.tradeDate), createdAt: D(t.createdAt) })) });
    if (d.cashTransactions?.length)
      await tx.cashTransaction.createMany({ data: d.cashTransactions.map((c: any) => ({ ...c, date: D(c.date), createdAt: D(c.createdAt) })) });
    if (d.appSettings?.length)
      await tx.appSetting.createMany({ data: d.appSettings.map((s: any) => ({ ...s, updatedAt: D(s.updatedAt) })) });
    if (d.fxRates?.length)
      await tx.fxRate.createMany({ data: d.fxRates.map((f: any) => ({ ...f, asOf: D(f.asOf) })) });
  }, { timeout: 60000 });

  console.log("\n✅ Restore abgeschlossen.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("Restore fehlgeschlagen:", e);
  process.exit(1);
});
