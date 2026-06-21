# Trade Tracker

Selbst-gehosteter Tracker für **Aktien- und Optionstrades** über mehrere Depots.
Manuelle, effiziente Erfassung mit Ticker-**Auto-Fill** (Stammdaten via Twelve Data),
**Optionen** (Long/Short Call/Put) inkl. **Rollen** (Bündelung gerollter Optionen zu
Ketten) und einer **filterbaren Übersicht**.

## Stack

- **Next.js 16** (App Router, TypeScript) · **PostgreSQL** + **Prisma 7** (pg-Adapter)
- Eigene **DB-Session-Auth**: Multi-User + Rollen, Argon2-Hashing, optionales **2FA/TOTP**
  (QR + Backup-Codes), Login-Rate-Limiting, E-Mail-Verifizierung & Passwort-Reset
- Tailwind CSS v4, eigene UI-Komponenten

> Hinweis: **Preise werden nicht** über die API geladen — du trägst deinen Ausführungspreis
> manuell ein. Twelve Data wird nur für die **Ticker-Suche** (`symbol_search`) genutzt.

## Voraussetzungen

- **Node.js ≥ 20.9** (z.B. via `nvm install 20`) — Next 16 läuft nicht auf Node 18
- **Docker** (für PostgreSQL bzw. das komplette Deployment)

## Lokale Entwicklung

```bash
cp .env.example .env          # AUTH_SECRET setzen (openssl rand -base64 48)
                              # optional: TWELVEDATA_API_KEY für Ticker-Suche
docker compose up -d db       # PostgreSQL starten
npm install
npm run db:migrate            # Schema anwenden
npm run dev                   # http://localhost:3000  (PORT=3100 falls 3000 belegt)
```

Der **erste registrierte Nutzer wird automatisch Admin** und ist ohne E-Mail-Server
sofort aktiv (ohne SMTP gelten Nutzer als verifiziert; Mail-Links landen im Server-Log).

## Deployment (Docker)

```bash
cp .env.example .env          # AUTH_SECRET + ggf. APP_PORT, SMTP_*, TWELVEDATA_API_KEY
docker compose up -d --build  # startet db + app, wendet Migrationen automatisch an
```

Die App ist für den Betrieb im internen Netz gedacht (Zugriff von außen via VPN).
Ist Port 3000 belegt, in `.env` `APP_PORT=3100` setzen.

## Nützliche Skripte

| Befehl | Zweck |
|--------|-------|
| `npm run db:migrate` | Migration erstellen/anwenden (Dev) |
| `npm run db:deploy`  | Migrationen anwenden (Prod) |
| `npm run test:logic` | End-to-End-Test der P&L-/Roll-/Andienungs-Logik gegen die DB |
| `npm run seed:demo`  | Demo-Daten + Session anlegen (gibt Cookie-Token aus) |
| `npm run lint`       | ESLint |

## Datenmodell (Kurzform)

`User → Account (Depot) → Position → Transaction`. Optionen tragen `right/strike/expiry`;
gerollte Optionen teilen sich eine `chainId` (alte Position `ROLLED`, neue verweist via
`prevPositionId`). Die Übersicht zeigt nur die jüngste Position der Kette und klappt die
Historie samt aggregiertem Ketten-P&L auf.

## Bewusste Grenzen

- Keine Live-Kurse / kein automatischer **unrealisierter** P&L (Preise sind manuell).
- EU-Optionsstammdaten sind per Gratis-API kaum verfügbar → EU-Optionen manuell erfassen
  (Underlying-Aktie hat Auto-Fill).
