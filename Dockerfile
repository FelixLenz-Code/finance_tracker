# Debian-basiert (glibc) — passt zu Prismas Schema-Engine; Alpine/musl würde Probleme machen.
# --- Dependencies ---
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy-URL nur für Build (Client-Import + generate); echte URL kommt zur Laufzeit.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder"
RUN npx prisma generate
RUN npm run build

# --- Runtime ---
# Volle node_modules statt standalone: Prisma-7-Migrate-CLI benötigt diverse
# Transitiv-Deps (@prisma/config → effect …). Für eine selbst-gehostete App ist
# Robustheit wichtiger als minimale Imagegröße.
FROM node:24-slim AS runner
WORKDIR /app
# Guard: Node < 24.22.1 ist von CVE-2026-111497 (HTTP2Shell, Brotli-RCE) betroffen —
# u. a. über serverseitiges fetch() mit `Content-Encoding: br`. Build bricht sonst ab.
RUN node -e 'const [a,b,c]=process.versions.node.split(".").map(Number); \
  if (a<24 || (a===24 && (b<22 || (b===22 && c<1)))) { \
    console.error("Node " + process.version + " ist anfällig für CVE-2026-111497 (>= 24.22.1 nötig)"); process.exit(1); }'
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# Migration anwenden, dann starten (Command via docker-compose überschrieben).
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000"]
