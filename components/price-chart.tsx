"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CandleInterval, KlineCandle } from "@/types/binance";

interface PriceChartProps {
  symbol: string;
  interval: CandleInterval;
}

interface ChartPoint {
  time: string;
  close: number;
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
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
          <XAxis dataKey="time" hide />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            width={70}
            tickFormatter={(value: number) => value.toFixed(4)}
          />
          <Tooltip
            formatter={(value: number) => [value.toFixed(6), "Close"]}
            labelFormatter={(label) => String(label)}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#10b981"
            fill="url(#priceFill)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
