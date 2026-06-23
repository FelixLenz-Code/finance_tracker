#!/usr/bin/env bash
# Trade Tracker — Installer & Updater (Linux)
#
#   Installieren / Updaten:
#     curl -fsSL https://raw.githubusercontent.com/FelixLenz-Code/finance_tracker/main/install.sh | bash
#
#   Lokal mit Subcommand:
#     ./install.sh [install|update|status|logs|uninstall]
#
# Erkennt eine bestehende Installation und aktualisiert sie (alles-oder-nichts via
# docker compose). Aktualisiert wird ausschließlich manuell (./install.sh update).
set -euo pipefail

# ---------------------------------------------------------------- Konfiguration
REPO="${REPO:-FelixLenz-Code/finance_tracker}"
IMAGE="${IMAGE:-ghcr.io/felixlenz-code/finance_tracker:latest}"
APP_PORT="${APP_PORT:-3000}"
# Installationsverzeichnis: als root systemweit, sonst im Home.
if [ "${INSTALL_DIR:-}" = "" ]; then
  if [ "$(id -u)" = "0" ]; then INSTALL_DIR="/opt/finance-tracker"; else INSTALL_DIR="$HOME/.finance-tracker"; fi
fi
# APP_URL: Basis-URL für generierte Links (E-Mail-Verifizierung, Passwort-Reset).
# Leer = beim Erzeugen der .env automatisch aus der Host-IP ableiten (statt localhost).
APP_URL="${APP_URL:-}"
# Für private GHCR-Images optional: GHCR_USER + GHCR_TOKEN setzen.
GHCR_USER="${GHCR_USER:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"

COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
ENV_FILE="$INSTALL_DIR/.env"

c_g() { printf '\033[32m%s\033[0m\n' "$*"; }
c_y() { printf '\033[33m%s\033[0m\n' "$*"; }
c_r() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
die() { c_r "Fehler: $*"; exit 1; }

# ----------------------------------------------------------- Voraussetzungen
detect_compose() {
  if docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose);
  elif command -v docker-compose >/dev/null 2>&1; then COMPOSE=(docker-compose);
  else die "Docker Compose nicht gefunden. Bitte Docker (inkl. Compose-Plugin) installieren: https://docs.docker.com/engine/install/"; fi
}
require_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker nicht gefunden. Installation: https://docs.docker.com/engine/install/"
  docker info >/dev/null 2>&1 || die "Docker-Daemon nicht erreichbar (läuft Docker? Rechte? ggf. mit sudo ausführen)."
  detect_compose
}
dc() { ( cd "$INSTALL_DIR" && "${COMPOSE[@]}" "$@" ); }

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -base64 "${1:-48}" | tr -d '\n';
  else head -c "${1:-48}" /dev/urandom | base64 | tr -d '\n'; fi
}

# URL-sicheres Passwort (nur Hex) — landet unkodiert in der DATABASE_URL, daher
# dürfen keine Sonderzeichen wie / + = vorkommen (sonst P1000 Auth-Fehler).
gen_db_password() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "${1:-24}";
  else head -c "${1:-24}" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

# Primäre, von außen erreichbare IPv4 des Hosts ermitteln (best effort).
detect_host_ip() {
  local ip=""
  if command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  printf '%s' "$ip"
}

# Effektive APP_URL: expliziter Wert hat Vorrang, sonst aus Host-IP (Fallback localhost).
effective_app_url() {
  if [ -n "$APP_URL" ]; then printf '%s' "$APP_URL"; return; fi
  local ip; ip="$(detect_host_ip)"
  printf 'http://%s:%s' "${ip:-localhost}" "$APP_PORT"
}

ghcr_login_if_needed() {
  if [ -n "$GHCR_TOKEN" ] && [ -n "$GHCR_USER" ]; then
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null 2>&1 \
      || c_y "GHCR-Login fehlgeschlagen — versuche trotzdem (öffentliches Image?)."
  fi
}

# ----------------------------------------------------------- Dateien schreiben
write_compose() {
  cat > "$COMPOSE_FILE" <<'YAML'
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: tracker
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}
      POSTGRES_DB: tracker
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tracker -d tracker"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    image: ${IMAGE}
    restart: unless-stopped
    pull_policy: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://tracker:${POSTGRES_PASSWORD}@db:5432/tracker?schema=public"
      APP_URL: "${APP_URL:-http://localhost:3000}"
      AUTH_SECRET: "${AUTH_SECRET:?set AUTH_SECRET}"
      TWELVEDATA_API_KEY: "${TWELVEDATA_API_KEY:-}"
      OPENFIGI_API_KEY: "${OPENFIGI_API_KEY:-}"
      SMTP_HOST: "${SMTP_HOST:-}"
      SMTP_PORT: "${SMTP_PORT:-587}"
      SMTP_USER: "${SMTP_USER:-}"
      SMTP_PASSWORD: "${SMTP_PASSWORD:-}"
      SMTP_FROM: "${SMTP_FROM:-Trade Tracker <no-reply@example.com>}"
      TOTP_ISSUER: "${TOTP_ISSUER:-Trade Tracker}"
    ports:
      - "${APP_PORT:-3000}:3000"
    command: sh -c "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000"

volumes:
  db_data:
YAML
}

write_env_if_missing() {
  local app_url; app_url="$(effective_app_url)"
  if [ -f "$ENV_FILE" ]; then
    c_y "Vorhandene .env beibehalten (AUTH_SECRET/Passwörter bleiben erhalten)."
    # Sicherstellen, dass IMAGE/APP_PORT/APP_URL existieren (für ältere Installs).
    grep -q '^IMAGE=' "$ENV_FILE" || echo "IMAGE=$IMAGE" >> "$ENV_FILE"
    grep -q '^APP_PORT=' "$ENV_FILE" || echo "APP_PORT=$APP_PORT" >> "$ENV_FILE"
    local cur_url; cur_url="$(grep -E '^APP_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
    if [ -z "$cur_url" ]; then
      echo "APP_URL=$app_url" >> "$ENV_FILE"
    elif printf '%s' "$cur_url" | grep -qiE '^http://localhost(:[0-9]+)?/?$' && [ "$cur_url" != "$app_url" ]; then
      # Alter localhost-Default → auf erreichbare Host-Adresse heben (E-Mail-Links).
      sed -i.bak "s#^APP_URL=.*#APP_URL=$app_url#" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
      c_y "APP_URL von localhost auf $app_url gesetzt (für korrekte E-Mail-Links)."
    fi
    return
  fi
  c_g "Erzeuge neue .env mit zufälligem AUTH_SECRET und DB-Passwort…"
  umask 077
  cat > "$ENV_FILE" <<EOF
# Trade Tracker — Instanz-Konfiguration. NICHT versionieren / sicher aufbewahren!
# AUTH_SECRET verschlüsselt 2FA-Secrets & gespeicherte API-/SMTP-/rclone-Keys —
# beim Wiederherstellen eines Backups MUSS dasselbe AUTH_SECRET verwendet werden.
# APP_URL steckt in den Links der Verifizierungs-/Reset-Mails — bei Bedarf auf den
# extern erreichbaren Host/Reverse-Proxy anpassen (z. B. https://tracker.example.com).
IMAGE=$IMAGE
APP_PORT=$APP_PORT
APP_URL=$app_url
AUTH_SECRET=$(gen_secret 48)
POSTGRES_PASSWORD=$(gen_db_password 24)

# Optional (auch im Admin-UI setzbar):
TWELVEDATA_API_KEY=
OPENFIGI_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Trade Tracker <no-reply@example.com>
TOTP_ISSUER=Trade Tracker
EOF
}

write_updater() {
  cat > "$INSTALL_DIR/update.sh" <<EOF
#!/usr/bin/env bash
# Automatisch erzeugt vom Trade-Tracker-Installer. Holt das neueste Image und
# startet die App neu (Migrationen laufen beim Start). Räumt alte Images weg.
set -euo pipefail
cd "$INSTALL_DIR"
${COMPOSE[*]} pull
${COMPOSE[*]} up -d
docker image prune -f >/dev/null 2>&1 || true
EOF
  chmod +x "$INSTALL_DIR/update.sh"
}

# --------------------------------------------- Alt-Installationen aufräumen
# Frühere Versionen richteten ein automatisches tägliches Update ein. Das wird
# nicht mehr unterstützt — vorhandene Timer/Cron-Einträge entfernen wir hier.
remove_auto_update() {
  local removed=""
  if [ "$(id -u)" = "0" ] && command -v systemctl >/dev/null 2>&1 \
     && [ -f /etc/systemd/system/finance-tracker-update.timer ]; then
    systemctl disable --now finance-tracker-update.timer >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/finance-tracker-update.service \
          /etc/systemd/system/finance-tracker-update.timer
    systemctl daemon-reload >/dev/null 2>&1 || true
    removed="systemd-Timer"
  fi
  if command -v crontab >/dev/null 2>&1 \
     && crontab -l 2>/dev/null | grep -q "# finance-tracker-auto-update"; then
    crontab -l 2>/dev/null | grep -v "# finance-tracker-auto-update" | crontab - 2>/dev/null || true
    removed="${removed:+$removed + }Cron-Eintrag"
  fi
  [ -n "$removed" ] && c_y "Früheres Auto-Update entfernt ($removed) — Updates jetzt nur noch manuell."
}

is_installed() { [ -f "$COMPOSE_FILE" ]; }

print_access() {
  local port; port="$(grep -E '^APP_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)"; port="${port:-$APP_PORT}"
  local url; url="$(grep -E '^APP_URL=' "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2-)"
  echo
  c_g "Trade Tracker läuft → ${url:-http://localhost:$port}"
  echo  "Lokal:       http://localhost:${port}"
  echo  "Verzeichnis: $INSTALL_DIR"
  echo  "APP_URL (E-Mail-Links) in $ENV_FILE anpassbar (z. B. hinter Reverse-Proxy)."
  echo  "Erster registrierter Nutzer wird automatisch Admin."
}

# ----------------------------------------------------------- Aktionen
do_install() {
  require_docker
  mkdir -p "$INSTALL_DIR"
  if is_installed; then
    c_y "Bestehende Installation erkannt in $INSTALL_DIR → aktualisiere."
    write_compose                      # Compose-Vorlage aktualisieren (idempotent)
    write_env_if_missing
    write_updater
    ghcr_login_if_needed
    dc pull
    dc up -d
    docker image prune -f >/dev/null 2>&1 || true
    remove_auto_update
    print_access
    return
  fi
  c_g "Installiere Trade Tracker nach $INSTALL_DIR …"
  write_compose
  write_env_if_missing
  write_updater
  ghcr_login_if_needed
  dc pull
  dc up -d
  remove_auto_update
  print_access
}

do_update() {
  require_docker
  is_installed || die "Keine Installation in $INSTALL_DIR gefunden. Erst installieren."
  c_g "Aktualisiere Trade Tracker in $INSTALL_DIR …"
  write_compose
  write_updater
  ghcr_login_if_needed
  dc pull
  dc up -d
  docker image prune -f >/dev/null 2>&1 || true
  remove_auto_update
  print_access
}

do_status() {
  require_docker
  is_installed || die "Keine Installation in $INSTALL_DIR gefunden."
  dc ps
}

do_logs() {
  require_docker
  is_installed || die "Keine Installation in $INSTALL_DIR gefunden."
  dc logs -f --tail=100
}

do_uninstall() {
  require_docker
  is_installed || die "Keine Installation in $INSTALL_DIR gefunden."
  c_y "Stoppe und entferne Container/Netzwerk …"
  dc down
  if [ "$(id -u)" = "0" ] && [ -f /etc/systemd/system/finance-tracker-update.timer ]; then
    systemctl disable --now finance-tracker-update.timer >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/finance-tracker-update.{service,timer}
    systemctl daemon-reload || true
  fi
  crontab -l 2>/dev/null | grep -v "# finance-tracker-auto-update" | crontab - 2>/dev/null || true
  echo
  c_y "Container entfernt. Daten (Volume db_data) und $INSTALL_DIR bleiben erhalten."
  echo "Daten ebenfalls löschen:  (cd $INSTALL_DIR && ${COMPOSE[*]} down -v) && rm -rf $INSTALL_DIR"
}

usage() {
  cat <<EOF
Trade Tracker — Installer (Linux)

  install     Installiert oder aktualisiert (Standard)
  update      Holt das neueste Image und startet neu
  status      Zeigt den Container-Status
  logs        Folgt den Logs
  uninstall   Entfernt Container/Timer (Daten bleiben)

Umgebungsvariablen: INSTALL_DIR, APP_PORT, IMAGE, GHCR_USER, GHCR_TOKEN
EOF
}

case "${1:-install}" in
  install) do_install ;;
  update)  do_update ;;
  status)  do_status ;;
  logs)    do_logs ;;
  uninstall) do_uninstall ;;
  -h|--help|help) usage ;;
  *) usage; exit 1 ;;
esac
