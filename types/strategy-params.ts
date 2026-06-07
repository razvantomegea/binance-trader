export interface StrategyParams {
  entryRangePct: number;
  entryRangeMaxPct: number;
  buyNotionalPct: number;
  trailingStopPct: number;
  maxLossPct: number;
  symbolReentryCooldownMs: number;
}
