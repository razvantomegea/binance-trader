import { NextResponse } from "next/server";

import { runStrategy } from "@/helpers/strategy/strategy-runner";

export async function POST() {
  try {
    const result = await runStrategy();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Strategy run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
