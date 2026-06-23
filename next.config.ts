import type { NextConfig } from "next";

// Content-Security-Policy: 'unsafe-inline' für script/style ist nötig, weil die App
// keine Nonce-Middleware nutzt und der PDF-Druck (Popup via document.write) sowie der
// 2FA-QR-Code (data:-Bild) inline arbeiten. frame-ancestors/object-src/base-uri/
// form-action bleiben restriktiv. Eine strikte Nonce-CSP wäre eine spätere Härtung.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join("; ");

const securityHeaders = [
  // HSTS — nur über HTTPS wirksam; im internen HTTP-Betrieb ignoriert der Browser es.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  /* Standard-Build; das Docker-Image nutzt `next start` mit vollen node_modules
     (robust mit Prisma 7, dessen migrate-CLI diverse Transitiv-Deps braucht). */
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
