import { NextResponse } from "next/server";
import { getBackupToken } from "@/lib/settings";
import { runBackup } from "@/lib/backup";
import { safeEqual } from "@/lib/crypto";

/**
 * Maschinen-Endpoint für automatisierte Backups (z. B. Host-Cron).
 * Authentifizierung via `Authorization: Bearer <BACKUP_CRON_TOKEN>`.
 */
export async function POST(req: Request) {
  const token = await getBackupToken();
  if (!token) {
    return NextResponse.json({ error: "backup not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided || !safeEqual(provided, token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = await runBackup();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
