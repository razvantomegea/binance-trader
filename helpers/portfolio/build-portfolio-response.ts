import { INITIAL_PAPER_CASH } from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { getCash } from "@/helpers/strategy/get-cash";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import type { OpenPosition } from "@/helpers/strategy/get-positions";
import type { PortfolioResponse, PositionRow } from "@/types/portfolio";
import { getLatestClosedKline } from "@/utils/binance/get-klines";
import { pnlPercentFromPrices } from "@/utils/pnl-percent";
import { processInBatches } from "@/utils/process-in-batches";
import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";

interface PositionMetrics {
  positions: PositionRow[];
  positionsValue: number;
  positionsCostBasis: number;
}

async function loadPriceBySymbol(
  symbols: string[],
  interval: typeof STRATEGY_INTERVAL,
) {
  const priceBySymbol = new Map<string, number>();
  if (symbols.length === 0) {
    return priceBySymbol;
  }

  const prices = await processInBatches({
    items: symbols,
    batchSize: BINANCE_FETCH_CONCURRENCY,
    processItem: async (symbol) => {
      const candle = await getLatestClosedKline({ symbol, interval });
      return { symbol, close: candle?.close ?? null };
    },
  });

  for (const { symbol, close } of prices) {
    if (close !== null) {
      priceBySymbol.set(symbol, close);
    }
  }
  return priceBySymbol;
}

function buildPositionMetrics(params: {
  positionsMap: Map<string, OpenPosition>;
  priceBySymbol: Map<string, number>;
}): PositionMetrics {
  let positionsValue = 0;
  let positionsCostBasis = 0;
  const positions: PositionRow[] = [];

  for (const position of params.positionsMap.values()) {
    const currentPrice = params.priceBySymbol.get(position.symbol) ?? null;
    const marketValue =
      currentPrice !== null ? position.qty * currentPrice : null;
    const unrealizedPnlPct =
      currentPrice !== null && position.buyPrice !== 0
        ? pnlPercentFromPrices(position.buyPrice, currentPrice)
        : null;

    positionsCostBasis += position.qty * position.buyPrice;
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

  return { positions, positionsValue, positionsCostBasis };
}

function buildPortfolioTotals(params: {
  cash: number;
  positionsValue: number;
  positionsCostBasis: number;
}) {
  const equity = params.cash + params.positionsValue;
  const totalPnl = equity - INITIAL_PAPER_CASH;
  const unrealizedPnl = params.positionsValue - params.positionsCostBasis;
  const realizedPnl = totalPnl - unrealizedPnl;

  return {
    equity,
    totalPnl,
    realizedPnl,
    unrealizedPnl,
    realizedPnlPct: (realizedPnl / INITIAL_PAPER_CASH) * 100,
    unrealizedPnlPct: (unrealizedPnl / INITIAL_PAPER_CASH) * 100,
    pnlPct: ((equity - INITIAL_PAPER_CASH) / INITIAL_PAPER_CASH) * 100,
  };
}

export async function buildPortfolioResponse(): Promise<PortfolioResponse> {
  const priceInterval = STRATEGY_INTERVAL;
  const cash = await getCash();
  const positionsMap = await getOpenPositions();
  const symbols = [...positionsMap.keys()];
  const priceBySymbol = await loadPriceBySymbol(symbols, priceInterval);
  const { positions, positionsValue, positionsCostBasis } =
    buildPositionMetrics({
      positionsMap,
      priceBySymbol,
    });
  const totals = buildPortfolioTotals({
    cash,
    positionsValue,
    positionsCostBasis,
  });

  return {
    cash,
    equity: totals.equity,
    pnlPct: totals.pnlPct,
    totalPnl: totals.totalPnl,
    realizedPnl: totals.realizedPnl,
    realizedPnlPct: totals.realizedPnlPct,
    unrealizedPnl: totals.unrealizedPnl,
    unrealizedPnlPct: totals.unrealizedPnlPct,
    positionCount: positions.length,
    positions: positions.sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}
