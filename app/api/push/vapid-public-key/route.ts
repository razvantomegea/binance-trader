import { NextResponse } from "next/server";

function normalizeVapidPublicKey(value: string): string {
  const trimmed = value.trim();
  const withoutQuotes =
    trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1)
      : trimmed;
  return withoutQuotes.trim();
}

export async function GET() {
  const rawPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const publicKey = rawPublicKey ? normalizeVapidPublicKey(rawPublicKey) : null;
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
