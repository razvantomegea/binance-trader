import { NextResponse } from "next/server";

import { stopStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";

export async function POST() {
  return NextResponse.json(stopStrategyHeartbeat());
}
