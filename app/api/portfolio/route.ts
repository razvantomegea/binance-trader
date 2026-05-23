import { NextResponse } from "next/server";

import { buildPortfolioResponse } from "@/helpers/portfolio/build-portfolio-response";

export async function GET() {
  try {
    const portfolio = await buildPortfolioResponse();
    return NextResponse.json(portfolio);
  } catch {
    return NextResponse.json(
      { error: "Failed to load portfolio" },
      { status: 500 },
    );
  }
}
