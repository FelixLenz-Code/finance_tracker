import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const AUTH_SECRET = process.env.AUTH_SECRET ?? "insecure-dev-secret";

/** Zufälliges, URL-sicheres Token (z.B. für Session-Cookie, Mail-Links). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256-Hash (hex) — für nicht-geheime Tokens (Session/Mail), in DB gespeichert. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Konstantzeit-Vergleich zweier hex/gleichlanger Strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// --- AES-256-GCM für TOTP-Secret (reversibel verschlüsselt mit AUTH_SECRET) ---

const key = scryptSync(AUTH_SECRET, "totp-enc-salt", 32);

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
