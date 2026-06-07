import {
  BUY_NOTIONAL_PCT,
  ENTRY_RANGE_MAX_PCT,
  ENTRY_RANGE_PCT,
  MAX_LOSS_PCT,
  TRAILING_STOP_PCT,
} from "@/constants/binance";
import { SYMBOL_REENTRY_COOLDOWN_MS } from "@/constants/strategy";
import type { StrategyParams } from "@/types/strategy-params";

export const DEFAULT_STRATEGY_PARAMS: StrategyParams = {
  entryRangePct: ENTRY_RANGE_PCT,
  entryRangeMaxPct: ENTRY_RANGE_MAX_PCT,
  buyNotionalPct: BUY_NOTIONAL_PCT,
  trailingStopPct: TRAILING_STOP_PCT,
  maxLossPct: MAX_LOSS_PCT,
  symbolReentryCooldownMs: SYMBOL_REENTRY_COOLDOWN_MS,
};
