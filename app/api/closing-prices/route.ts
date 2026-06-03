import { NextResponse } from "next/server";

import type { CandleInterval } from "@/types/binance";
import { getClosingPrices } from "@/helpers/closing-prices/get-closing-prices";
import { InvalidSymbolsError } from "@/helpers/closing-prices/invalid-symbols-error";
import { parseSymbolsFilter } from "@/utils/api/parse-symbols-filter";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const intervalsParam = searchParams.get("intervals");

  if (intervalsParam && intervalsParam.trim().toUpperCase() !== "H1") {
    return NextResponse.json(
      { error: "Invalid intervals. Supported: H1" },
      { status: 400 },
    );
  }

  const intervals: CandleInterval[] = ["H1"];

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
