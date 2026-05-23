import { NextResponse } from "next/server";

import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";

export async function GET() {
  try {
    const symbols = await getUsdtSymbols();
    return NextResponse.json({ symbols });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch symbols from Binance" },
      { status: 502 },
    );
  }
}
