import { NextResponse } from "next/server";

import { getTrades } from "@/helpers/trades/get-trades";
import { parseBoundedInt } from "@/utils/api/parse-bounded-int";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseBoundedInt({
    value: searchParams.get("limit"),
    defaultValue: 50,
    min: 1,
    max: 200,
  });
  const offset = parseBoundedInt({
    value: searchParams.get("offset"),
    defaultValue: 0,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });

  try {
    const response = await getTrades({ limit, offset });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to load trades" },
      { status: 500 },
    );
  }
}
