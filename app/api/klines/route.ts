import { NextResponse } from "next/server";

import type { CandleInterval } from "@/types/binance";
import { parseBoundedInt } from "@/utils/api/parse-bounded-int";
import { getKlines } from "@/utils/binance/get-klines";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const intervalParam = searchParams.get("interval");
  const limit = parseBoundedInt({
    value: searchParams.get("limit"),
    defaultValue: 200,
    min: 2,
    max: 1000,
  });

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  if (!isUsdtSymbol(symbol)) {
    return NextResponse.json(
      { error: "Only symbols ending with USDT are allowed" },
      { status: 400 },
    );
  }

  if (intervalParam && intervalParam.trim().toUpperCase() !== "H1") {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  const interval: CandleInterval = "H1";

  try {
    const candles = await getKlines({ symbol, interval, limit });
    return NextResponse.json({ symbol, interval, candles });
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
