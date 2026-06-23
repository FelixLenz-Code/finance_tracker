import "server-only";
import { createHash } from "node:crypto";

// Kleine Offline-Basisliste sehr gängiger Passwörter mit >=10 Zeichen (untere Grenze
// der Validierung). Garantiert eine Mindestabwehr, auch wenn die HIBP-API nicht
// erreichbar ist. Vergleich erfolgt case-insensitiv.
const COMMON = new Set(
  [
    "password",
    "password1",
    "password12",
    "password123",
    "password1234",
    "passwort123",
    "1234567890",
    "12345678901",
    "123456789012",
    "qwertzuiop",
    "qwertyuiop",
    "1q2w3e4r5t",
    "iloveyou123",
    "letmein123",
    "adminadmin",
    "administrator",
    "willkommen1",
    "trustno1234",
    "superman123",
    "michael123",
    "sunshine123",
    "princess123",
    "babygirl123",
    "football123",
  ].map((p) => p.toLowerCase()),
);

/**
 * Ist das Passwort kompromittiert/zu gängig? Prüft erst die Offline-Liste, dann die
 * Have-I-Been-Pwned-Range-API (k-anonymity: nur die ersten 5 Zeichen des SHA-1-Hash
 * verlassen den Server). Bei Netz-/API-Fehlern: fail-open (false), um legitime
 * Registrierungen nicht zu blockieren — die Offline-Liste greift dann trotzdem.
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  if (COMMON.has(password.toLowerCase())) return true;

  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix && Number(countStr) > 0) return true;
    }
    return false;
  } catch {
    // API nicht erreichbar / Timeout → nicht blockieren.
    return false;
  }
}
