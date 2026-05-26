"use client";

import { useEffect, useState } from "react";

import type { CandleInterval, KlineCandle } from "@/types/binance";

import { BaseAreaChart } from "./base-area-chart";

interface PriceChartProps {
  symbol: string;
  interval: CandleInterval;
}

interface ChartPoint {
  time: string;
  close: number;
}

const formatTooltipValue = (value: number) => value.toFixed(6);
const formatYAxis = (value: number) => value.toFixed(4);

export function PriceChart({ symbol, interval }: PriceChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=200`,
        );

        if (!response.ok) {
          throw new Error("Failed to load chart data");
        }

        const json = (await response.json()) as { candles: KlineCandle[] };
        if (cancelled) {
          return;
        }

        setData(
          json.candles.map((candle) => ({
            time: new Date(candle.openTime).toLocaleString(),
            close: candle.close,
          })),
        );
      } catch {
        if (!cancelled) {
          setError("Chart unavailable");
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-zinc-500">
        Loading chart...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <BaseAreaChart
        data={data}
        dataKey="close"
        color="#10b981"
        gradientId="priceFill"
        tooltipLabel="Close"
        tooltipValueFormatter={formatTooltipValue}
        yAxisDomain={["auto", "auto"]}
        yAxisFormatter={formatYAxis}
      />
    </div>
  );
}
