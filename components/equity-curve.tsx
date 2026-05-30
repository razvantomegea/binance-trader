"use client";

import type { EquitySnapshotRow } from "@/types/portfolio";

import { chartContainerClassName } from "@/components/chart-container";

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
      <div
        className={`flex items-center justify-center text-sm text-zinc-500 ${chartContainerClassName}`}
      >
        Loading equity curve...
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-zinc-500 ${chartContainerClassName}`}
      >
        No equity snapshots yet
      </div>
    );
  }

  const data = snapshots.map((row) => ({
    time: new Date(row.ts).toLocaleString(),
    equity: row.equity,
  }));

  return (
    <BaseAreaChart
      data={data}
      dataKey="equity"
      color="#3b82f6"
      gradientId="equityFill"
      tooltipLabel="Equity"
      tooltipValueFormatter={formatTooltipValue}
    />
  );
}
