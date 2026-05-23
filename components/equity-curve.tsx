"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EquitySnapshotRow } from "@/types/portfolio";

interface EquityCurveProps {
  snapshots: EquitySnapshotRow[];
  loading: boolean;
}

export function EquityCurve({ snapshots, loading }: EquityCurveProps) {
  if (loading && snapshots.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
        Loading equity curve...
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
        No equity snapshots yet
      </div>
    );
  }

  const data = snapshots.map((row) => ({
    time: new Date(row.ts).toLocaleString(),
    equity: row.equity,
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
          <XAxis dataKey="time" hide />
          <YAxis tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            formatter={(value: number) => [
              value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              "Equity",
            ]}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#3b82f6"
            fill="url(#equityFill)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
