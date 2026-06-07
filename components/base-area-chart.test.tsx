import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useElementSize } from "@/hooks/use-element-size";

import { BaseAreaChart } from "./base-area-chart";

vi.mock("@/hooks/use-element-size");

const mockedUseElementSize = vi.mocked(useElementSize);

vi.mock("recharts", () => ({
  AreaChart: ({
    children,
    margin,
  }: {
    children: React.ReactNode;
    margin?: { right?: number };
  }) => (
    <div data-testid="area-chart" data-margin-right={margin?.right}>
      {children}
    </div>
  ),
  Area: ({ strokeWidth }: { strokeWidth?: number }) => (
    <div data-testid="area" data-stroke-width={strokeWidth} />
  ),
  CartesianGrid: () => null,
  Tooltip: ({
    formatter,
  }: {
    formatter?: (value: unknown, ...rest: unknown[]) => [string, string];
  }) => {
    formatter?.("not-a-number", "equity", { payload: { equity: 10_500 } });
    formatter?.(Number.NaN, "equity", { payload: { equity: 10_500 } });
    return null;
  },
  XAxis: () => null,
  YAxis: ({
    tick,
    width,
  }: {
    tick?: { fontSize?: number };
    width?: number;
  }) => (
    <div
      data-testid="y-axis"
      data-tick-size={tick?.fontSize}
      data-width={width}
    />
  ),
}));

const chartData = [
  { time: "2026-06-07T10:00:00.000Z", equity: 10_500 },
  { time: "2026-06-07T11:00:00.000Z", equity: 10_600 },
];

describe("BaseAreaChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders chart when container has dimensions", () => {
    mockedUseElementSize.mockReturnValue({
      ref: { current: null },
      width: 800,
      height: 300,
    });
    render(
      <BaseAreaChart
        data={chartData}
        dataKey="equity"
        color="#3b82f6"
        gradientId="equityFill"
        tooltipLabel="Equity"
        tooltipValueFormatter={(value) => value.toFixed(2)}
      />,
    );

    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area")).toBeInTheDocument();
  });

  it("does not render chart before size is measured", () => {
    mockedUseElementSize.mockReturnValue({
      ref: { current: null },
      width: 0,
      height: 0,
    });

    const { container } = render(
      <BaseAreaChart
        data={chartData}
        dataKey="equity"
        color="#3b82f6"
        gradientId="equityFill"
        tooltipLabel="Equity"
        tooltipValueFormatter={(value) => value.toFixed(2)}
      />,
    );

    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders compact layout below the breakpoint", () => {
    mockedUseElementSize.mockReturnValue({
      ref: { current: null },
      width: 500,
      height: 240,
    });

    render(
      <BaseAreaChart
        data={chartData}
        dataKey="equity"
        color="#3b82f6"
        gradientId="equityFill"
        tooltipLabel="Equity"
        tooltipValueFormatter={(value) => value.toFixed(2)}
        yAxisDomain={["auto", "auto"]}
        yAxisFormatter={(value) => value.toFixed(1)}
      />,
    );

    expect(screen.getByTestId("area-chart")).toHaveAttribute(
      "data-margin-right",
      "4",
    );
    expect(screen.getByTestId("area")).toHaveAttribute(
      "data-stroke-width",
      "1.5",
    );
    expect(screen.getByTestId("y-axis")).toHaveAttribute(
      "data-tick-size",
      "10",
    );
    expect(screen.getByTestId("y-axis")).toHaveAttribute("data-width", "52");
  });

  it("does not render chart when only width is measured", () => {
    mockedUseElementSize.mockReturnValue({
      ref: { current: null },
      width: 800,
      height: 0,
    });

    render(
      <BaseAreaChart
        data={chartData}
        dataKey="equity"
        color="#3b82f6"
        gradientId="equityFill"
        tooltipLabel="Equity"
        tooltipValueFormatter={(value) => value.toFixed(2)}
      />,
    );

    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });
});
