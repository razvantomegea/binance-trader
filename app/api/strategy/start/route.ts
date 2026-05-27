import { NextResponse } from "next/server";

import { startStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";
import { hasValidCronSecret } from "@/utils/api/cron-secret-auth";

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await startStrategyHeartbeat();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[strategy/start] failed", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
