"use client";

import type { EquitySnapshotRow } from "@/types/portfolio";

import { BaseAreaChart } from "./base-area-chart";

interface EquityCurveProps {
  snapshots: EquitySnapshotRow[];
  loading: boolean;
}

const formatTooltipValue = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

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
      <BaseAreaChart
        data={data}
        dataKey="equity"
        color="#3b82f6"
        gradientId="equityFill"
        tooltipLabel="Equity"
        tooltipValueFormatter={formatTooltipValue}
      />
    </div>
  );
}
