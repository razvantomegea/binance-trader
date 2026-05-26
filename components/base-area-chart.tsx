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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
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
          tick={{ fontSize: 11 }}
          width={70}
          tickFormatter={yAxisFormatter}
        />
        <Tooltip
          formatter={(value: number) => [
            tooltipValueFormatter(value),
            tooltipLabel,
          ]}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: "#09090b",
            border: "1px solid #27272a",
            borderRadius: "0.5rem",
          }}
          labelStyle={{ color: "#d4d4d8" }}
          itemStyle={{ color: "#fafafa" }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
