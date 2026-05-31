import { NextResponse } from "next/server";

import {
  closeOpenPosition,
  PositionNotFoundError,
} from "@/helpers/strategy/close-open-position";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";

interface ClosePositionBody {
  symbol?: unknown;
}

export async function POST(request: Request) {
  let body: ClosePositionBody;
  try {
    body = (await request.json()) as ClosePositionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol =
    typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  if (!isUsdtSymbol(symbol)) {
    return NextResponse.json(
      { error: "Only symbols ending with USDT are allowed" },
      { status: 400 },
    );
  }

  try {
    await closeOpenPosition({ symbol });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PositionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[positions/close] failed", error);
    const message =
      error instanceof Error ? error.message : "Failed to close position";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
