import { NextResponse } from "next/server";

import { startStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";

export async function POST() {
  return NextResponse.json(startStrategyHeartbeat());
}
