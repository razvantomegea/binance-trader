import { NextResponse } from "next/server";

import { resolveVapidPublicKey } from "@/helpers/notifications/vapid-env";

export async function GET() {
  const publicKey = await resolveVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Web push is not configured" },
      { status: 503 },
    );
  }

  if (publicKey.length < 80 || publicKey.length > 120) {
    console.error("[api/push/vapid-public-key] invalid key format", {
      keyLength: publicKey.length,
    });
    return NextResponse.json(
      { error: "WEB_PUSH_VAPID_PUBLIC_KEY has invalid format" },
      { status: 503 },
    );
  }

  return NextResponse.json({ publicKey });
}
