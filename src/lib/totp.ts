import * as OTPAuth from "otpauth";
import { randomBytes } from "node:crypto";

const ISSUER = process.env.TOTP_ISSUER ?? "Trade Tracker";

function build(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

/** Neues TOTP-Secret (Base32) erzeugen. */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** otpauth://-URL für QR-Code. */
export function totpUri(secretBase32: string, accountLabel: string): string {
  return build(secretBase32, accountLabel).toString();
}

/** Token prüfen (±1 Zeitfenster Toleranz). */
export function verifyTotp(secretBase32: string, token: string): boolean {
  const clean = token.replace(/\s/g, "");
  const delta = build(secretBase32, "verify").validate({ token: clean, window: 1 });
  return delta !== null;
}

/** N Backup-Codes im Format xxxx-xxxx erzeugen (Klartext, wird danach gehasht). */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(4).toString("hex"); // 8 hex chars
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}
