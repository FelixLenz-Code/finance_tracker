import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { getStoredVapidKeys, setVapidKeys, getVapidSubject } from "@/lib/settings";

export type PushPayload = { title: string; body: string; url?: string };

/**
 * VAPID-Schlüssel laden — beim ersten Aufruf einmalig erzeugen und speichern.
 * App-weit (nicht pro Nutzer); der öffentliche Schlüssel wird für das Abonnement
 * an den Client gegeben.
 */
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const stored = await getStoredVapidKeys();
  if (stored.publicKey && stored.privateKey) {
    return { publicKey: stored.publicKey, privateKey: stored.privateKey };
  }
  const keys = webpush.generateVAPIDKeys();
  await setVapidKeys(keys.publicKey, keys.privateKey);
  return keys;
}

/** Öffentlicher VAPID-Schlüssel für die Client-Subscription. */
export async function getVapidPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

/** web-push mit den aktuellen VAPID-Details konfigurieren. */
async function configureWebPush(): Promise<void> {
  const { publicKey, privateKey } = await getVapidKeys();
  const subject = await getVapidSubject();
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Push an alle Subscriptions eines Nutzers senden. Abgelaufene Subscriptions
 * (404/410) werden entfernt. Gibt die Anzahl erfolgreicher Zustellungen zurück.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  await configureWebPush();
  const data = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
        } else {
          console.error("[push] Zustellung fehlgeschlagen:", status ?? e);
        }
      }
    }),
  );

  return sent;
}
