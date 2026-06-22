# Trade Tracker

Selbst-gehosteter Tracker für **Aktien- und Optionstrades** über mehrere Depots.
Manuelle, effiziente Erfassung mit Ticker-**Auto-Fill** (Stammdaten via Twelve Data,
WKN/ISIN-Auflösung via OpenFIGI), **Optionen** (Long/Short Call/Put) inkl. **Rollen**
(Bündelung gerollter Optionen zu Ketten), Kontostand/Cashflows und auswertbaren
Dashboards.

> **Preise werden nicht** über eine API geladen — du trägst deinen Ausführungspreis
> manuell ein. Es gibt daher nur **realisierten** G&V (aus geschlossenen Positionen),
> keinen automatischen unrealisierten G&V offener Positionen.

## Funktionen

- **Dashboard** — Kennzahlen (Cash-Saldo, gebundenes Kapital, realisierter G&V,
  Trefferquote), „Verfällt bald" (offene Optionen ≤ 7 Tage), Kapital-Allokation und
  gebundenes Kapital je Instrument als Donut, realisierter G&V pro Monat.
- **Trades** — filterbare Übersicht (Depot, Art, Status, Call/Put, Suche, Datum),
  Erfassung & alle Aktionen (Schließen/Verkaufen, Rollen, Verfall, Andienung, Bearbeiten,
  Roll rückgängig, Wieder öffnen, Löschen) als **Popups**; Roll-Ketten aufklappbar,
  Notizen je Transaktion.
- **Statistik** — Auswertung pro Depot und pro Instrument, filterbar nach Depot/Art.
- **Steuer** — Jahresreport (DE): realisierter G&V getrennt nach **Aktien** und
  **Optionen/Termingeschäften** (Gewinne/Verluste separat) plus **Dividenden**, je Währung;
  Einzelposten-Liste und **CSV-Export**.
- **Depots** — anlegen/bearbeiten/löschen, mehrere Währungen je Depot, **Import/Export**
  einzelner Depots als JSON (verlustfrei, inkl. Roll-Ketten).
- **Kontostand** — je Depot Saldo, frei verfügbar, gebundenes Kapital, Einzahlungen netto,
  Dividenden und realisierter G&V; Aktienbestand; Ein-/Auszahlungen **und Dividenden** (Popup);
  Buchungsliste (manuelle Buchungen + automatische Cashflows aus Trades).
- **Einstellungen** — Profil, **2FA/TOTP**, persönliche **Optionsablauf-Erinnerungen** (je
  Nutzer: an/aus, Frist in Tagen, Uhrzeit), und als Admin: Marktdaten-Keys, **E-Mail-Server
  (SMTP)** mit Test-Versand sowie das **verschlüsselte Offsite-Backup** (siehe unten).

## Stack

- **Next.js 16** (App Router, TypeScript) · **PostgreSQL** + **Prisma 7** (pg-Adapter)
- Eigene **DB-Session-Auth**: Multi-User + Rollen, Argon2-Hashing, optionales **2FA/TOTP**
  (QR + Backup-Codes), Login-Rate-Limiting, E-Mail-Verifizierung & Passwort-Reset
- Tailwind CSS v4, eigene UI-Komponenten

### Marktdaten (optional)

Twelve Data wird nur für die **Ticker-Suche** (`symbol_search`) genutzt, OpenFIGI für die
**WKN-/ISIN-Auflösung** (funktioniert auch ohne Key, ein Key erhöht nur das Rate-Limit).
Beide Keys lassen sich entweder über `TWELVEDATA_API_KEY` / `OPENFIGI_API_KEY` in `.env`
setzen **oder** als Admin unter **Einstellungen → Marktdaten** eintragen (AES-GCM-verschlüsselt
in der DB; hat Vorrang vor `.env`).

## Voraussetzungen

- **Node.js ≥ 20.9** (z. B. via `nvm install 20`) — Next 16 läuft nicht auf Node 18
- **Docker** (für PostgreSQL bzw. das komplette Deployment)
- **rclone** — nur falls das Offsite-Backup genutzt wird (`apt install rclone`)

## Lokale Entwicklung

```bash
cp .env.example .env          # AUTH_SECRET setzen (openssl rand -base64 48)
                              # optional: TWELVEDATA_API_KEY / OPENFIGI_API_KEY
docker compose up -d db       # PostgreSQL starten
npm install
npm run db:migrate            # Schema anwenden
npm run dev                   # http://localhost:3000  (PORT=3100 falls 3000 belegt)
```

Der **erste registrierte Nutzer wird automatisch Admin** und ist ohne E-Mail-Server
sofort aktiv (ohne SMTP gelten Nutzer als verifiziert; Mail-Links landen im Server-Log).

## Deployment (Docker)

```bash
cp .env.example .env          # AUTH_SECRET + ggf. APP_PORT, SMTP_*, Marktdaten-Keys
docker compose up -d --build  # startet db + app, wendet Migrationen automatisch an
```

Die App ist für den Betrieb im internen Netz gedacht (Zugriff von außen via VPN).
Ist Port 3000 belegt, in `.env` `APP_PORT=3100` setzen.

## Depots exportieren / importieren

Auf der **Depots**-Seite kann jedes Depot einzeln als JSON **exportiert** (Link „Export")
und über **„Depot importieren"** wieder **importiert** werden — verlustfrei inkl.
Positionen, Roll-Ketten, Transaktionen und Cash-Buchungen. Beim Import entsteht ein neues
Depot des angemeldeten Nutzers; Instrumente werden global per (Symbol, Börse) aufgelöst.
Das eignet sich für Migration/Weitergabe einzelner Depots — für vollständige Sicherungen
siehe das Offsite-Backup unten.

## Backup & Restore

Das Backup ist ein **vollständiger, komprimierter Datenbank-Snapshot** (`*.json.gz` —
alle Depots, Positionen, Transaktionen, Cash-Buchungen sowie Nutzer/Einstellungen). Die
**Verschlüsselung** und der Upload übernimmt [rclone](https://rclone.org/) über ein
`crypt`-Remote. Konfiguriert wird alles als Admin unter **Einstellungen → Offsite-Backup**
(die rclone-Config wird verschlüsselt in der DB gespeichert).

### 1. Verschlüsseltes rclone-Remote einrichten (Beispiel: Backblaze B2)

Voraussetzung: `rclone` ist installiert (`apt install rclone` bzw. im App-Image enthalten).

```bash
rclone config
```

1. **Storage-Remote anlegen** — `n` → Name z. B. `b2` → Typ `Backblaze B2` →
   `account` (keyID) und `key` (applicationKey) aus dem B2-Konto eintragen.
   (Analog für S3, WebDAV, Google Drive, … — irgendein von rclone unterstützter Speicher.)
2. **Crypt-Remote darüberlegen** — `n` → Name z. B. `crypt` → Typ `crypt` →
   `remote` = `b2:DEIN-BUCKET/tracker` → Verschlüsselung der Dateinamen nach Wunsch →
   **Passwörter setzen** (gut notieren! ohne sie ist das Backup nicht wiederherstellbar).

Test:

```bash
echo hallo | rclone rcat crypt:test.txt && rclone cat crypt:test.txt && rclone delete crypt:test.txt
```

Den **Inhalt der rclone-Config** anzeigen (das wird in die App eingefügt):

```bash
rclone config show          # oder: cat ~/.config/rclone/rclone.conf
```

### 2. In der App konfigurieren

**Einstellungen → Offsite-Backup — rclone**:

- **Ziel**: das crypt-Remote inkl. Pfad, z. B. `crypt:tracker-backups`
- **rclone-Konfiguration**: den kompletten `rclone.conf`-Inhalt aus Schritt 1 einfügen
- **Backup jetzt ausführen** zum Testen — Status/letztes Ergebnis erscheinen direkt darunter.

> Die rclone-Config liegt AES-GCM-verschlüsselt in der DB und wird nur serverseitig kurz
> in eine temporäre Datei geschrieben. `pg_dump` wird **nicht** benötigt (rein logischer
> Prisma-Snapshot).

### 3. Automatisieren (Scheduling)

**Am einfachsten: eingebaute Automatik.** Es ist **nichts zu aktivieren** — ein in-process
Scheduler (`instrumentation.ts`) läuft automatisch: Sobald das **Backup** eingerichtet ist, wird
es **einmal täglich** erstellt; **Erinnerungen** verschickt er pro Nutzer zur jeweils selbst
gewählten **Uhrzeit/Frist** (sobald SMTP eingerichtet ist). Kein externer Cron, kein Token nötig.
Voraussetzung: die App läuft als dauerhafter Prozess (Docker/`next start`).

Alternativ (oder zusätzlich) per **externem Cron** auf die HTTP-Endpunkte: ein Token unter
Einstellungen erzeugen und auslösen. Zwei Wege:

**a) Host-Cron ruft die CLI** (wenn App + DB auf der Maschine erreichbar sind):

```cron
# täglich 03:30 — Pfad zum Projekt anpassen
30 3 * * * cd /opt/finance_tracker && /usr/bin/npm run backup >> /var/log/tracker-backup.log 2>&1
```

**b) HTTP-Endpoint** (gut für Container/remote): in der App ein **Cron-Token** erzeugen
(Einstellungen → Offsite-Backup → „Token erzeugen") und per `curl` auslösen:

```cron
30 3 * * * curl -fsS -X POST -H "Authorization: Bearer DEIN_TOKEN" https://DEIN-HOST/api/backup/run
```

Optional als **systemd-Timer** statt Cron:

```ini
# /etc/systemd/system/tracker-backup.service
[Service]
Type=oneshot
WorkingDirectory=/opt/finance_tracker
ExecStart=/usr/bin/npm run backup

# /etc/systemd/system/tracker-backup.timer
[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now tracker-backup.timer
```

Retention/Rotation übernimmt am einfachsten der Speicher selbst (z. B. B2-Lifecycle-Regeln)
oder ein zusätzlicher `rclone delete --min-age 30d crypt:tracker-backups`-Cron.

### 4. Schlüssel sichern (wichtig!)

Das verschlüsselte Backup ist nur mit dem **crypt-Passwort** wiederherstellbar. Liegt dieses
ausschließlich in der App-DB, verlierst du im Katastrophenfall (DB weg) zugleich den
Schlüssel. Daher **getrennt vom Backup** aufbewahren — z. B. in einem Passwort-Manager.
Die gespeicherte `rclone.conf` (enthält das crypt-Passwort) lässt sich dafür unter
**Einstellungen → Offsite-Backup → „rclone-Config herunterladen"** (nach erneuter
Passwort-Abfrage) exportieren.

### 5. Wiederherstellen

```bash
# Verschlüsselte Backup-Datei aus dem Remote holen (rclone entschlüsselt automatisch):
rclone cat crypt:tracker-backups/tracker-backup-….json.gz > /tmp/restore.json.gz

# In eine LEERE Datenbank einspielen (Original-IDs werden übernommen):
npm run restore -- /tmp/restore.json.gz --yes
```

Der Restore läuft als eine Transaktion (alles-oder-nichts) und bricht ab, wenn die
Ziel-DB bereits Nutzer enthält — also vorher eine frische DB anlegen/migrieren
(`npm run db:deploy`).

> ⚠ **`AUTH_SECRET` mitsichern!** 2FA-Secrets sowie gespeicherte API-/rclone-Configs liegen
> mit `AUTH_SECRET` (AES-GCM) verschlüsselt im Snapshot. Ein Restore ist nur dann vollständig
> brauchbar, wenn die Ziel-Instanz **dasselbe `AUTH_SECRET`** verwendet — andernfalls lassen
> sich diese Werte nicht mehr entschlüsseln (Nutzer müssten 2FA neu einrichten, Keys neu
> eintragen). Bewahre `AUTH_SECRET` daher getrennt vom Backup sicher auf.

## Nützliche Skripte

| Befehl | Zweck |
|--------|-------|
| `npm run db:migrate` | Migration erstellen/anwenden (Dev) |
| `npm run db:deploy`  | Migrationen anwenden (Prod) |
| `npm run test:logic` | End-to-End-Test der G&V-/Roll-/Andienungs-Logik gegen die DB |
| `npm run seed:demo`  | Demo-Daten + Session anlegen (gibt Cookie-Token aus) |
| `npm run backup`     | Verschlüsseltes Offsite-Backup sofort ausführen |
| `npm run restore`    | Snapshot zurückspielen: `npm run restore -- <datei.json.gz> --yes` |
| `npm run lint`       | ESLint |

## Datenmodell (Kurzform)

`User → Account (Depot) → Position → Transaction`, dazu `CashTransaction` (Ein-/Auszahlungen)
und global geteilte `Instrument`-Stammdaten. Optionen tragen `right/strike/expiry`; gerollte
Optionen teilen sich eine `chainId` (alte Position `ROLLED`, neue verweist via
`prevPositionId`). Die Übersicht zeigt nur die jüngste Position der Kette und klappt die
Historie samt aggregiertem Ketten-G&V auf.

## Bewusste Grenzen

- Keine Live-Kurse / kein automatischer **unrealisierter** G&V (Preise sind manuell).
- EU-Optionsstammdaten sind per Gratis-API kaum verfügbar → EU-Optionen manuell erfassen
  (Underlying-Aktie hat Auto-Fill).
