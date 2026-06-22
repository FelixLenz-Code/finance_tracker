import { NextResponse } from "next/server";
import { getReminderToken } from "@/lib/settings";
import { sendAllRemindersNow } from "@/lib/reminders";
import { safeEqual } from "@/lib/crypto";

/**
 * Maschinen-Endpoint für Optionsablauf-Erinnerungen (z. B. täglicher Host-Cron).
 * Authentifizierung via `Authorization: Bearer <REMINDER_CRON_TOKEN>`.
 */
export async function POST(req: Request) {
  const token = await getReminderToken();
  if (!token) {
    return NextResponse.json({ error: "reminders not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided || !safeEqual(provided, token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await sendAllRemindersNow();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
