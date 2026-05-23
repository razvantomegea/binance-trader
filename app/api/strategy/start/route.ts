import { NextResponse } from "next/server";

import { startStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";

export async function POST() {
  try {
    const result = startStrategyHeartbeat();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[strategy/start] failed", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
