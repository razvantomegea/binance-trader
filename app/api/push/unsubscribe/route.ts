import { NextResponse } from "next/server";

import { removePushSubscription } from "@/helpers/notifications/subscriptions";
import { blockProductionMutations } from "@/utils/api/block-production-mutations";
import { getErrorDetails } from "@/utils/error-handling";
import { parseUnsubscribeBody } from "@/utils/notifications/parse-push-subscription";

export async function POST(request: Request) {
  const blocked = blockProductionMutations();
  if (blocked) {
    return blocked;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    console.error("[api/push/unsubscribe] invalid json body", {
      details: getErrorDetails(err),
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseUnsubscribeBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid unsubscribe payload" },
      { status: 400 },
    );
  }

  try {
    await removePushSubscription(parsed.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const details = getErrorDetails(err);
    console.error("[api/push/unsubscribe] failed to remove subscription", {
      endpoint: parsed.endpoint,
      details,
    });
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 },
    );
  }
}
