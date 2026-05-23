import { NextResponse } from "next/server";

import { runStrategy } from "@/helpers/strategy/strategy-runner";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorizationHeader = request.headers.get("authorization");
  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : undefined;
  const headerToken = request.headers.get("x-cron-secret")?.trim();
  const token = bearerToken || headerToken;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runStrategy();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Strategy run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
