import { NextResponse } from "next/server";

import { upsertPushSubscription } from "@/helpers/notifications/subscriptions";
import { getErrorDetails } from "@/utils/error-handling";
import { parsePushSubscriptionBody } from "@/utils/notifications/parse-push-subscription";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    console.error("[api/push/subscribe] invalid json body", {
      details: getErrorDetails(err),
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subscription = parsePushSubscriptionBody(body);
  if (!subscription) {
    return NextResponse.json(
      { error: "Invalid subscription payload" },
      { status: 400 },
    );
  }

  try {
    await upsertPushSubscription(subscription);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const details = getErrorDetails(err);
    console.error("[api/push/subscribe] failed to save subscription", {
      endpoint: subscription.endpoint,
      details,
    });
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 },
    );
  }
}
