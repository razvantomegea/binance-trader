export function assertLocalhostOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Backtest is localhost-only and cannot run when NODE_ENV=production",
    );
  }
}
