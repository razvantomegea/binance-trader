import { NextResponse } from "next/server";

import { getStrategyHeartbeatStatus } from "@/helpers/scheduler/strategy-heartbeat";

export async function GET() {
  return NextResponse.json(getStrategyHeartbeatStatus());
}
