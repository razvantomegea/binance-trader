import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import type { PushSubscriptionInput } from "@/helpers/notifications/types";

export async function upsertPushSubscription({
  endpoint,
  keys,
}: PushSubscriptionInput): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(pushSubscriptions)
    .values({
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        updatedAt: now,
      },
    });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await getDb()
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function listPushSubscriptions(): Promise<
  Array<{ endpoint: string; p256dh: string; auth: string }>
> {
  return getDb().select().from(pushSubscriptions);
}
