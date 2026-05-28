import { INITIAL_PAPER_CASH } from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { getCash } from "@/helpers/strategy/get-cash";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import type { PortfolioResponse, PositionRow } from "@/types/portfolio";
import { getLatestClosedKline } from "@/utils/binance/get-klines";
import { pnlPercentFromPrices } from "@/utils/pnl-percent";
import { processInBatches } from "@/utils/process-in-batches";
import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
export async function buildPortfolioResponse(): Promise<PortfolioResponse> {
  const priceInterval = STRATEGY_INTERVAL;
  const cash = await getCash();
  const positionsMap = await getOpenPositions();
  const symbols = [...positionsMap.keys()];

  const priceBySymbol = new Map<string, number>();

  if (symbols.length > 0) {
    const prices = await processInBatches({
      items: symbols,
      batchSize: BINANCE_FETCH_CONCURRENCY,
      processItem: async (symbol) => {
        const candle = await getLatestClosedKline({
          symbol,
          interval: priceInterval,
        });
        return { symbol, close: candle?.close ?? null };
      },
    });

    for (const { symbol, close } of prices) {
      if (close !== null) {
        priceBySymbol.set(symbol, close);
      }
    }
  }

  let positionsValue = 0;
  const positions: PositionRow[] = [];

  for (const position of positionsMap.values()) {
    const currentPrice = priceBySymbol.get(position.symbol) ?? null;
    const marketValue =
      currentPrice !== null ? position.qty * currentPrice : null;
    const unrealizedPnlPct =
      currentPrice !== null && position.buyPrice !== 0
        ? pnlPercentFromPrices(position.buyPrice, currentPrice)
        : null;

    if (marketValue !== null) {
      positionsValue += marketValue;
    }

    positions.push({
      symbol: position.symbol,
      qty: String(position.qty),
      buyPrice: String(position.buyPrice),
      maxPriceAfterBuy:
        position.maxPriceAfterBuy != null
          ? String(position.maxPriceAfterBuy)
          : null,
      buyTime: position.buyTime.toISOString(),
      buyTradeId: position.buyTradeId,
      currentPrice: currentPrice !== null ? String(currentPrice) : null,
      unrealizedPnlPct,
    });
  }

  const equity = cash + positionsValue;
  const pnlPct = ((equity - INITIAL_PAPER_CASH) / INITIAL_PAPER_CASH) * 100;

  return {
    cash,
    equity,
    pnlPct,
    positionCount: positions.length,
    positions: positions.sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}
