"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import type { SettingsState } from "./actions";
import { getPushPublicKey, subscribePush, unsubscribePush } from "./actions";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

/** base64url-VAPID-Schlüssel → Uint8Array (ArrayBuffer-gestützt) für pushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function MyReminderSettings({
  initial,
  mailConfigured,
  saveAction,
}: {
  initial: { enabled: boolean; days: number; hour: number; pushEnabled: boolean };
  mailConfigured: boolean;
  saveAction: Action;
}) {
  const [state, save, saving] = useActionState(saveAction, {} as SettingsState);
  const [enabled, setEnabled] = useState(initial.enabled);

  // --- Push ---
  const [pushOn, setPushOn] = useState(initial.pushEnabled);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Feature-Detection erst nach dem Mounten (Browser-APIs sind beim SSR nicht da).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(
      typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, []);

  async function enablePush() {
    setPushBusy(true);
    setPushMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushMsg({ kind: "err", text: "Benachrichtigungen wurden im Browser nicht erlaubt." });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = await getPushPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      await subscribePush({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setPushOn(true);
      setPushMsg({ kind: "ok", text: "Push auf diesem Gerät aktiviert." });
    } catch (e) {
      setPushMsg({ kind: "err", text: `Aktivierung fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}.` });
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await unsubscribePush(sub?.endpoint);
      if (sub) await sub.unsubscribe();
      setPushOn(false);
      setPushMsg({ kind: "ok", text: "Push deaktiviert." });
    } catch (e) {
      setPushMsg({ kind: "err", text: `Deaktivierung fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}.` });
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!mailConfigured && (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
          Der E-Mail-Versand ist noch nicht eingerichtet — bitte an den Administrator wenden. Deine
          Einstellungen werden trotzdem gespeichert und greifen, sobald E-Mail aktiv ist.
        </p>
      )}
      <form action={save} className="flex flex-wrap items-end gap-4">
        <label className="flex cursor-pointer items-center gap-2 pb-2">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          <span className="text-sm text-zinc-200">E-Mail-Erinnerungen aktiv</span>
        </label>
        <div className="w-full sm:w-44">
          <Label htmlFor="rem-days">Frist (Tage vor Verfall)</Label>
          <Input id="rem-days" name="days" type="number" min="1" max="90" defaultValue={initial.days} disabled={!enabled} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="rem-hour">Uhrzeit</Label>
          <Select id="rem-hour" name="hour" defaultValue={initial.hour} disabled={!enabled}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
        {state.notice && <span className="pb-2 text-sm text-emerald-300">{state.notice}</span>}
      </form>
      <p className="text-xs text-zinc-500">
        Du erhältst eine tägliche E-Mail, wenn offene Optionen innerhalb der Frist verfallen —
        zur eingestellten Uhrzeit. Frist/Uhrzeit gelten auch für Push.
      </p>

      {/* Push-Benachrichtigungen (PWA) */}
      <div className="border-t border-white/5 pt-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={pushOn}
            disabled={!supported || pushBusy}
            onChange={(e) => (e.target.checked ? enablePush() : disablePush())}
            className="h-4 w-4 accent-emerald-500"
          />
          <span className="text-sm text-zinc-200">
            Push-Benachrichtigungen auf diesem Gerät {pushBusy && <span className="text-zinc-500">…</span>}
          </span>
        </label>
        {!supported ? (
          <p className="mt-2 text-xs text-amber-300">
            Dieser Browser unterstützt keine Web-Push-Benachrichtigungen (oder die Seite läuft nicht
            über HTTPS). Auf dem iPhone/iPad muss die App zuerst zum Home-Bildschirm hinzugefügt werden.
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Gleiche Inhalte wie die E-Mail-Erinnerung, direkt als System-Benachrichtigung. Pro Gerät
            separat aktivierbar. Erfordert HTTPS.
          </p>
        )}
        {pushMsg && (
          <p className={`mt-2 text-sm ${pushMsg.kind === "ok" ? "text-emerald-300" : "text-red-400"}`}>{pushMsg.text}</p>
        )}
      </div>
    </div>
  );
}
