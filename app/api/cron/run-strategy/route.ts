import { NextResponse } from "next/server";

import {
  getSchedulerRunning,
  recordSchedulerRun,
} from "@/helpers/scheduler/strategy-scheduler-meta";
import { runStrategy } from "@/helpers/strategy/strategy-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorizationHeader = request.headers.get("authorization");
  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : undefined;
  const headerToken = request.headers.get("x-cron-secret")?.trim();
  const token = bearerToken || headerToken;

  return Boolean(secret && token === secret);
}

async function handleCronRun(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const running = await getSchedulerRunning();
  if (!running) {
    return NextResponse.json({ skipped: true, reason: "scheduler stopped" });
  }

  try {
    const result = await runStrategy();
    await recordSchedulerRun({ result });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Strategy run failed";
    await recordSchedulerRun({ error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleCronRun(request);
}

export async function POST(request: Request) {
  return handleCronRun(request);
}
