import { NextResponse } from "next/server";

import { getStrategyHeartbeatStatus } from "@/helpers/scheduler/strategy-heartbeat";

export async function GET() {
  try {
    return NextResponse.json(getStrategyHeartbeatStatus());
  } catch (error) {
    console.error("[strategy/status] failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
