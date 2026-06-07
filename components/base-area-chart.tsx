"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartContainerClassName } from "@/components/chart-container";
import { useElementSize } from "@/hooks/use-element-size";

interface BaseAreaChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  dataKey: string;
  color: string;
  gradientId: string;
  tooltipLabel: string;
  tooltipValueFormatter: (value: number) => string;
  yAxisDomain?: [string | number, string | number];
  yAxisFormatter?: (value: number) => string;
}

const COMPACT_BREAKPOINT = 640;

function renderTooltipValue(
  valueFormatter: (value: number) => string,
  label: string,
  value: number,
) {
  return [valueFormatter(value), label];
}

function getTooltipContentStyle(compact: boolean) {
  return {
    backgroundColor: "#09090b",
    border: "1px solid #27272a",
    borderRadius: "0.5rem",
    fontSize: compact ? 12 : 14,
  };
}

function BaseAreaChartContent({
  data,
  dataKey,
  color,
  gradientId,
  tooltipLabel,
  tooltipValueFormatter,
  yAxisDomain,
  yAxisFormatter,
  compact,
  width,
  height,
}: BaseAreaChartProps & { compact: boolean; width: number; height: number }) {
  return (
    <AreaChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 4, right: compact ? 4 : 8, left: 0, bottom: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.35} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
      <XAxis dataKey="time" hide />
      <YAxis
        domain={yAxisDomain}
        tick={{ fontSize: compact ? 10 : 11 }}
        width={compact ? 52 : 70}
        tickFormatter={yAxisFormatter}
      />
      <Tooltip
        formatter={(value) => {
          const numericValue =
            typeof value === "number" ? value : Number(value ?? 0);
          return renderTooltipValue(
            tooltipValueFormatter,
            tooltipLabel,
            Number.isNaN(numericValue) ? 0 : numericValue,
          );
        }}
        labelFormatter={(label) => String(label)}
        contentStyle={getTooltipContentStyle(compact)}
        labelStyle={{ color: "#d4d4d8" }}
        itemStyle={{ color: "#fafafa" }}
      />
      <Area
        type="monotone"
        dataKey={dataKey}
        stroke={color}
        fill={`url(#${gradientId})`}
        strokeWidth={compact ? 1.5 : 2}
        dot={false}
      />
    </AreaChart>
  );
}

export function BaseAreaChart({
  data,
  dataKey,
  color,
  gradientId,
  tooltipLabel,
  tooltipValueFormatter,
  yAxisDomain,
  yAxisFormatter,
}: BaseAreaChartProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const compact = width > 0 && width < COMPACT_BREAKPOINT;
  const ready = width > 0 && height > 0;

  return (
    <div ref={ref} className={chartContainerClassName}>
      {ready ? (
        <BaseAreaChartContent
          data={data}
          dataKey={dataKey}
          color={color}
          gradientId={gradientId}
          tooltipLabel={tooltipLabel}
          tooltipValueFormatter={tooltipValueFormatter}
          yAxisDomain={yAxisDomain}
          yAxisFormatter={yAxisFormatter}
          compact={compact}
          width={width}
          height={height}
        />
      ) : null}
    </div>
  );
}
