import webpush from "web-push";

import {
  listPushSubscriptions,
  removePushSubscription,
} from "@/helpers/notifications/subscriptions";
import type { TradeExecutedPushPayload } from "@/helpers/notifications/types";
import { resolveVapidDetails } from "@/helpers/notifications/vapid-env";

let vapidConfigured = false;

async function ensureVapidConfigured(): Promise<boolean> {
  if (vapidConfigured) {
    return true;
  }

  const details = await resolveVapidDetails();
  if (!details) {
    return false;
  }

  webpush.setVapidDetails(
    details.subject,
    details.publicKey,
    details.privateKey,
  );
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
  if (!(await ensureVapidConfigured())) {
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
