import { NextResponse } from "next/server";

import { isRetryableDbError } from "@/db/with-db-retry";
import { getStrategyHeartbeatStatus } from "@/helpers/scheduler/strategy-heartbeat";

export async function GET() {
  try {
    return NextResponse.json(await getStrategyHeartbeatStatus());
  } catch (error) {
    console.error("[strategy/status] failed", error);
    const status = isRetryableDbError(error) ? 503 : 500;
    return NextResponse.json({ error: "Internal Server Error" }, { status });
  }
}
