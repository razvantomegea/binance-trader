export function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

export function safePct(numerator: number, denominator: number): number {
  return safeRatio(numerator, denominator) * 100;
}
