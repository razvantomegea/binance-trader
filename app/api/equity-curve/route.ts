import { NextResponse } from "next/server";

import { getEquityCurve } from "@/helpers/equity-curve/get-equity-curve";
import { parseBoundedInt } from "@/utils/api/parse-bounded-int";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseBoundedInt({
    value: searchParams.get("limit"),
    defaultValue: 200,
    min: 1,
    max: 1000,
  });

  try {
    const response = await getEquityCurve({ limit });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to load equity curve" },
      { status: 500 },
    );
  }
}
