import { NextResponse } from "next/server";

import { removePushSubscription } from "@/helpers/notifications/subscriptions";
import { parseUnsubscribeBody } from "@/utils/notifications/parse-push-subscription";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
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
  } catch {
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 },
    );
  }
}
