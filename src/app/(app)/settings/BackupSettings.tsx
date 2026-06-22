"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Input, Label, Badge, FormError } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { BackupStatus } from "@/lib/settings";
import type { SettingsState } from "./actions";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

export function BackupSettings({
  status,
  saveAction,
  removeAction,
  runAction,
  tokenAction,
  downloadAction,
}: {
  status: BackupStatus;
  saveAction: Action;
  removeAction: () => Promise<void>;
  runAction: Action;
  tokenAction: Action;
  downloadAction: Action;
}) {
  const [saveState, save, saving] = useActionState(saveAction, {} as SettingsState);
  const [runState, run, running] = useActionState(runAction, {} as SettingsState);
  const [tokenState, genToken, genning] = useActionState(tokenAction, {} as SettingsState);
  const [dlState, download, downloading] = useActionState(downloadAction, {} as SettingsState);
  const dlFormRef = useRef<HTMLFormElement>(null);

  // Sobald die Config (nach Passwort-Prüfung) eintrifft, als Datei herunterladen.
  useEffect(() => {
    if (!dlState.conf) return;
    const blob = new Blob([dlState.conf], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rclone.conf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    dlFormRef.current?.reset();
  }, [dlState]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = status.last;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {status.confSet ? <Badge color="green">Konfiguriert</Badge> : <Badge color="zinc">Nicht konfiguriert</Badge>}
        {status.dest && <span className="text-sm text-zinc-400">Ziel: <code className="text-zinc-300">{status.dest}</code></span>}
      </div>

      {last && (
        <div className="rounded-lg border border-white/5 bg-zinc-950/40 p-3 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <Badge color={last.ok ? "green" : "red"}>{last.ok ? "Erfolg" : "Fehler"}</Badge>
            <span className="text-zinc-400">{fmtDate(last.at)}</span>
            {last.file && <span className="text-zinc-500">· {last.file}</span>}
          </span>
          <p className="mt-1 text-zinc-300">{last.message}</p>
        </div>
      )}

      {/* Konfiguration */}
      <form action={save} className="space-y-3">
        <div>
          <Label htmlFor="dest">Ziel (rclone-Remote:Pfad)</Label>
          <Input
            id="dest"
            name="dest"
            defaultValue={status.dest ?? ""}
            placeholder="z. B. crypt:tracker-backups"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="conf">rclone-Konfiguration</Label>
          <textarea
            id="conf"
            name="conf"
            rows={8}
            placeholder={
              status.confSet
                ? "•••• (gespeichert — zum Ersetzen neue Config einfügen, leer = entfernen)"
                : "Inhalt der rclone.conf hier einfügen (inkl. crypt-Remote für Verschlüsselung)"
            }
            className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
            spellCheck={false}
          />
        </div>
        {saveState.notice && <p className="text-sm text-emerald-300">{saveState.notice}</p>}
        <FormError message={saveState.error} />
        <Button type="submit" disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
      </form>

      {/* Aktionen */}
      {status.confSet && (
        <div className="space-y-3 border-t border-white/5 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action={run}>
              <Button type="submit" variant="secondary" disabled={running}>
                {running ? "Backup läuft…" : "Backup jetzt ausführen"}
              </Button>
            </form>
            <form
              action={removeAction}
              onSubmit={(e) => {
                if (!confirm("Backup-Konfiguration (inkl. Token) wirklich entfernen?")) e.preventDefault();
              }}
            >
              <Button type="submit" variant="danger">Konfiguration entfernen</Button>
            </form>
          </div>
          {runState.notice && <p className="text-sm text-emerald-300">{runState.notice}</p>}
          <FormError message={runState.error} />

          {/* rclone-Config sichern (nach Passwort-Abfrage) */}
          <div className="space-y-2 rounded-lg border border-white/5 bg-zinc-950/40 p-3">
            <p className="text-sm font-medium text-zinc-300">rclone-Config sichern</p>
            <p className="text-xs text-zinc-500">
              Lädt die gespeicherte <code>rclone.conf</code> (enthält das crypt-Passwort) herunter.
              <b className="text-amber-300/90"> Getrennt vom Backup aufbewahren</b> — ohne dieses
              Passwort ist ein verschlüsseltes Backup nicht wiederherstellbar.
            </p>
            <form ref={dlFormRef} action={download} className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="dl-password">Passwort bestätigen</Label>
                <Input id="dl-password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <Button type="submit" variant="secondary" disabled={downloading}>
                {downloading ? "Prüfe…" : "rclone-Config herunterladen"}
              </Button>
            </form>
            <FormError message={dlState.error} />
          </div>
        </div>
      )}

      {/* Automatisierung */}
      <div className="space-y-2 border-t border-white/5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">Extern auslösen (optional)</span>
          {status.hasToken ? <Badge color="green">Token aktiv</Badge> : <Badge color="zinc">Kein Token</Badge>}
        </div>
        <p className="text-xs text-zinc-500">
          Nur nötig ohne die eingebaute „Automatik". Ein externer Scheduler kann das Backup
          per HTTP auslösen:
        </p>
        <pre className="overflow-x-auto rounded-md border border-white/5 bg-zinc-950/60 p-2 text-xs text-zinc-300">
{`curl -X POST -H "Authorization: Bearer <TOKEN>" \\
  https://DEIN-HOST/api/backup/run`}
        </pre>
        {tokenState.token && (
          <p className="break-all rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-200">
            Token: <code className="font-mono">{tokenState.token}</code>
          </p>
        )}
        {tokenState.notice && !tokenState.token && <p className="text-sm text-emerald-300">{tokenState.notice}</p>}
        <form action={genToken}>
          <Button type="submit" variant="secondary" disabled={genning}>
            {genning ? "Erzeuge…" : status.hasToken ? "Token neu erzeugen" : "Token erzeugen"}
          </Button>
        </form>
      </div>

      <p className="text-xs text-zinc-500">
        Gesichert wird ein vollständiger, komprimierter Datenbank-Snapshot (JSON.gz) — alle Depots, Positionen,
        Transaktionen, Cash-Buchungen sowie Nutzer/Einstellungen. Die <b>Verschlüsselung</b> übernimmt ein
        rclone-<code>crypt</code>-Remote: Ziel auf ein crypt-Remote zeigen lassen. Die rclone-Config wird
        verschlüsselt in der Datenbank gespeichert und nur serverseitig in eine temporäre Datei geschrieben.{" "}
        <a href="https://rclone.org/crypt/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
          rclone crypt ↗
        </a>
      </p>
    </div>
  );
}
