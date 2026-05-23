import { NextResponse } from "next/server";

import { getKlinesResponse } from "@/helpers/klines/get-klines-response";
import { parseBoundedInt } from "@/utils/api/parse-bounded-int";
import { parseSingleCandleInterval } from "@/utils/parse-candle-interval";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const interval = parseSingleCandleInterval(searchParams.get("interval"));
  const limit = parseBoundedInt({
    value: searchParams.get("limit"),
    defaultValue: 200,
    min: 2,
    max: 1000,
  });

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  if (!interval) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  try {
    const response = await getKlinesResponse({ symbol, interval, limit });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch klines response", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json(
      { error: "Failed to fetch klines" },
      { status: 500 },
    );
  }
}
