import { NextResponse } from "next/server";

import { stopStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";
import { hasValidCronSecret } from "@/utils/api/cron-secret-auth";

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await stopStrategyHeartbeat();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[strategy/stop] failed", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
