/**
 * Zeitzonen-Helfer für zeitgesteuerte Aufgaben (Erinnerungen, Backup).
 *
 * Der Scheduler vergleicht die vom Nutzer gewählte Stunde gegen die aktuelle
 * Uhrzeit. `Date#getHours()` nutzt aber die Zeitzone des Server-Prozesses —
 * im Container i. d. R. UTC — und nicht die vom Nutzer gemeinte Lokalzeit.
 * Diese Helfer rechnen Stunde und Tages-Datum explizit in einer definierten
 * Zeitzone (Default Europe/Berlin, via APP_TZ überschreibbar), damit das
 * Verhalten unabhängig von der Server-Zeitzone ist.
 */

export const APP_TZ = process.env.APP_TZ || "Europe/Berlin";

/** Stunde (0–23) zum Zeitpunkt `d` in der angegebenen Zeitzone. */
export function zonedHour(d: Date = new Date(), tz: string = APP_TZ): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return Number(h) % 24; // h23 → "00".."23"; %24 schützt vor "24" in Alt-ICU
}

/** Datums-Schlüssel "YYYY-MM-DD" zum Zeitpunkt `d` in der angegebenen Zeitzone. */
export function zonedDateKey(d: Date = new Date(), tz: string = APP_TZ): string {
  // en-CA formatiert als YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
