import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { error: "Web push is not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({ publicKey });
}
