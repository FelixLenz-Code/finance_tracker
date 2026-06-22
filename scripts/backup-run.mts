// Manuelles/automatisiertes Backup über die CLI (z. B. via Host-Cron).
// Nutzt dieselbe Logik wie der „Backup jetzt"-Button und der HTTP-Endpoint.
import { runBackup } from "@/lib/backup";

async function main() {
  const res = await runBackup();
  console.log(`[${res.at}] ${res.ok ? "OK" : "FEHLER"}: ${res.message}`);
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("Backup fehlgeschlagen:", e);
  process.exit(1);
});
