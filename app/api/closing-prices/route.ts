import { NextResponse } from "next/server";

import { CANDLE_INTERVALS } from "@/constants/binance";
import { getClosingPrices } from "@/helpers/closing-prices/get-closing-prices";
import { InvalidSymbolsError } from "@/helpers/closing-prices/invalid-symbols-error";
import { parseSymbolsFilter } from "@/utils/api/parse-symbols-filter";
import { parseCandleIntervals } from "@/utils/binance/parse-candle-intervals";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const intervals = parseCandleIntervals(searchParams.get("intervals"));

  if (!intervals) {
    return NextResponse.json(
      {
        error: `Invalid intervals. Use comma-separated values from: ${CANDLE_INTERVALS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    let symbolsFilter: string[] | undefined;
    try {
      symbolsFilter = parseSymbolsFilter(searchParams.get("symbols"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid symbols filter";
      return NextResponse.json(
        { error: `Invalid symbols filter: ${message}` },
        { status: 400 },
      );
    }

    const response = await getClosingPrices({ intervals, symbolsFilter });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof InvalidSymbolsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to fetch symbols from Binance" },
      { status: 502 },
    );
  }
}
