import {
  BUY_NOTIONAL_PCT,
  ENTRY_RANGE_MAX_PCT,
  ENTRY_RANGE_PCT,
  MAX_LOSS_PCT,
  TRAILING_STOP_PCT,
} from "@/constants/binance";
import {
  STRATEGY_INTERVAL,
  STRATEGY_LOOKBACK_CLOSES,
} from "@/constants/strategy";

const STRATEGY_PRIOR_CLOSES = STRATEGY_LOOKBACK_CLOSES - 1;

function formatPct(value: number): string {
  return `${(value * 100).toFixed(Number.isInteger(value * 100) ? 0 : 1)}%`;
}

export const STRATEGY_DESCRIPTION = [
  `${STRATEGY_INTERVAL} paper strategy`,
  `last close vs prior ${STRATEGY_PRIOR_CLOSES} closes`,
  `entry: current and highest close both ${formatPct(ENTRY_RANGE_PCT)}-${formatPct(ENTRY_RANGE_MAX_PCT)} above lowest 24h close`,
  `size: ${formatPct(BUY_NOTIONAL_PCT)} cash`,
  `exit: ${formatPct(TRAILING_STOP_PCT)} trailing stop, ${formatPct(MAX_LOSS_PCT)} max loss per trade and account while open`,
].join(" | ");
