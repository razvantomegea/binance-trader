import { NextResponse } from "next/server";

export function blockProductionMutations(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This action is disabled in production" },
      { status: 403 },
    );
  }
  return null;
}
