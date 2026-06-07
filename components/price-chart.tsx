"use client";

import { useEffect, useState } from "react";

import type { CandleInterval, KlineCandle } from "@/types/binance";

import { chartContainerClassName } from "@/components/chart-container";

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
const CHART_LIMIT = 200;

function buildChartUrl(symbol: string, interval: CandleInterval): string {
  return `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${CHART_LIMIT}`;
}

function mapCandlesToChartPoints(candles: KlineCandle[]): ChartPoint[] {
  return candles.map((candle) => ({
    time: new Date(candle.openTime).toLocaleString(),
    close: candle.close,
  }));
}

function ChartStateMessage({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  return (
    <div
      className={`flex items-center justify-center text-sm ${className} ${chartContainerClassName}`}
    >
      {text}
    </div>
  );
}

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
        const response = await fetch(buildChartUrl(symbol, interval));

        if (!response.ok) {
          throw new Error("Failed to load chart data");
        }

        const json = (await response.json()) as { candles: KlineCandle[] };
        if (cancelled) {
          return;
        }

        setData(mapCandlesToChartPoints(json.candles));
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
      <ChartStateMessage text="Loading chart..." className="text-zinc-500" />
    );
  }

  if (error) {
    return <ChartStateMessage text={error} className="text-red-500" />;
  }

  return (
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
  );
}
