import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
import { getDb } from "@/db";
import { equitySnapshots } from "@/db/schema";
import { getCash } from "@/helpers/strategy/get-cash";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import type { CandleInterval } from "@/types/binance";
import { getLatestClosedKline } from "@/utils/binance/get-klines";
import { processInBatches } from "@/utils/process-in-batches";

export async function snapshotEquity({
  interval,
}: {
  interval: CandleInterval;
}): Promise<{ cash: number; equity: number }> {
  const cash = await getCash();
  const positionsMap = await getOpenPositions();
  const symbols = [...positionsMap.keys()];

  let positionsValue = 0;

  if (symbols.length > 0) {
    const prices = await processInBatches({
      items: symbols,
      batchSize: BINANCE_FETCH_CONCURRENCY,
      processItem: async (symbol) => {
        const candle = await getLatestClosedKline({ symbol, interval });
        return { symbol, close: candle?.close ?? null };
      },
    });

    for (const { symbol, close } of prices) {
      const position = positionsMap.get(symbol);
      if (!position || close === null) {
        continue;
      }
      const value = position.qty * close;
      if (!Number.isFinite(value)) {
        continue;
      }
      positionsValue += value;
    }
  }

  if (!Number.isFinite(positionsValue)) {
    throw new Error("Invalid positionsValue computed in snapshotEquity");
  }

  const equity = cash + positionsValue;

  await getDb()
    .insert(equitySnapshots)
    .values({
      cash: String(cash),
      equity: String(equity),
      interval,
    });

  return { cash, equity };
}
