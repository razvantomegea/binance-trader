import webpush from "web-push";

import {
  listPushSubscriptions,
  removePushSubscription,
} from "@/helpers/notifications/subscriptions";
import type { TradeExecutedPushPayload } from "@/helpers/notifications/types";

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) {
    return true;
  }

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function isStaleSubscriptionError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const { statusCode } = err as { statusCode?: number };
  return statusCode === 404 || statusCode === 410;
}

export async function sendTradeExecutedPush(
  payload: TradeExecutedPushPayload,
): Promise<void> {
  if (!ensureVapidConfigured()) {
    console.warn("Web push skipped: VAPID env vars not configured");
    return;
  }

  const subscriptions = await listPushSubscriptions();
  if (subscriptions.length === 0) {
    return;
  }

  const message = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message,
        );
      } catch (err) {
        if (isStaleSubscriptionError(err)) {
          await removePushSubscription(sub.endpoint);
          return;
        }
        console.error("Web push send failed", {
          endpoint: sub.endpoint,
          err,
        });
      }
    }),
  );
}
