import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { prisma } from "@/lib/db";
import { getBackupRcloneConf, getBackupDest, setBackupLast } from "@/lib/settings";

export type BackupResult = {
  ok: boolean;
  message: string;
  at: string;
  file?: string;
  bytes?: number;
};

/**
 * Vollständiger logischer Snapshot der Datenbank als gzip-JSON.
 * Enthält alle fachlichen Tabellen + Auth/Settings (für Disaster-Recovery).
 * Flüchtige Tabellen (Sessions, Tokens, Login-Versuche) werden bewusst ausgelassen.
 */
export async function buildSnapshot(): Promise<{ buffer: Buffer; counts: Record<string, number> }> {
  const [users, backupCodes, accounts, cashTransactions, instruments, positions, transactions, appSettings, fxRates] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.backupCode.findMany(),
      prisma.account.findMany(),
      prisma.cashTransaction.findMany(),
      prisma.instrument.findMany(),
      prisma.position.findMany(),
      prisma.transaction.findMany(),
      prisma.appSetting.findMany(),
      prisma.fxRate.findMany(),
    ]);

  const snapshot = {
    format: "trade-tracker/full-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    data: { users, backupCodes, accounts, cashTransactions, instruments, positions, transactions, appSettings, fxRates },
  };

  // Prisma serialisiert Decimal → String und Date → ISO via JSON.stringify.
  const buffer = gzipSync(Buffer.from(JSON.stringify(snapshot), "utf8"));
  const counts = {
    users: users.length,
    accounts: accounts.length,
    positions: positions.length,
    transactions: transactions.length,
    cashTransactions: cashTransactions.length,
  };
  return { buffer, counts };
}

function runRclone(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn("rclone", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

/**
 * Erzeugt einen Snapshot und lädt ihn per rclone ins konfigurierte Ziel.
 * Verschlüsselung erfolgt über ein rclone-`crypt`-Remote im Ziel.
 * Schreibt das Ergebnis als `BACKUP_LAST_RESULT` zurück.
 */
export async function runBackup(): Promise<BackupResult> {
  const at = new Date().toISOString();
  const [conf, dest] = await Promise.all([getBackupRcloneConf(), getBackupDest()]);
  if (!conf || !dest) {
    return { ok: false, message: "Backup nicht konfiguriert (rclone-Config oder Ziel fehlt).", at };
  }

  let dir: string | null = null;
  try {
    const { buffer, counts } = await buildSnapshot();
    const stamp = at.replace(/[:.]/g, "-");
    const filename = `tracker-backup-${stamp}.json.gz`;

    dir = await mkdtemp(join(tmpdir(), "tracker-backup-"));
    const confPath = join(dir, "rclone.conf");
    const filePath = join(dir, filename);
    await writeFile(confPath, conf, { mode: 0o600 });
    await writeFile(filePath, buffer, { mode: 0o600 });

    const { code, stderr } = await runRclone([
      "--config", confPath,
      "copy", filePath, dest,
      "--no-traverse",
    ]);

    if (code !== 0) {
      const r: BackupResult = {
        ok: false,
        at,
        message: `rclone-Fehler (Code ${code}): ${stderr.trim().slice(-400) || "unbekannt"}`,
      };
      await setBackupLast(JSON.stringify(r)).catch(() => {});
      return r;
    }

    const r: BackupResult = {
      ok: true,
      at,
      file: filename,
      bytes: buffer.length,
      message: `Backup hochgeladen: ${counts.accounts} Depots, ${counts.positions} Positionen, ${counts.transactions} Transaktionen.`,
    };
    await setBackupLast(JSON.stringify(r));
    return r;
  } catch (e) {
    const raw = e instanceof Error ? e.message : "unbekannter Fehler";
    const message = raw.includes("ENOENT")
      ? "rclone wurde nicht gefunden (ist es installiert und im PATH des Server-Prozesses?)."
      : raw;
    const r: BackupResult = { ok: false, message, at };
    await setBackupLast(JSON.stringify(r)).catch(() => {});
    return r;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
