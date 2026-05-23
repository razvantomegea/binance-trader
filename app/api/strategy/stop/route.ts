import { NextResponse } from "next/server";

import { stopStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";

export async function POST() {
  try {
    const result = await stopStrategyHeartbeat();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[strategy/stop] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
