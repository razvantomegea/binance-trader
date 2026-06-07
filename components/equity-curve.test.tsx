import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTestId } from "@/constants/data-test-id";
import type { EquitySnapshotRow } from "@/types/portfolio";

import { EquityCurve } from "./equity-curve";

vi.mock("./base-area-chart", () => ({
  BaseAreaChart: ({
    tooltipValueFormatter,
  }: {
    tooltipValueFormatter: (value: number) => string;
  }) => (
    <div data-testid="base-area-chart-mock">
      {tooltipValueFormatter(12_345.678)}
    </div>
  ),
}));

const snapshots: EquitySnapshotRow[] = [
  {
    id: 1,
    ts: "2026-06-07T10:00:00.000Z",
    cash: 10_000,
    equity: 10_500,
    interval: "H1",
  },
];

describe("EquityCurve", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders loading state when loading with no snapshots", () => {
    render(<EquityCurve snapshots={[]} loading />);

    expect(screen.getByTestId(DataTestId.EquityCurveLoading)).toHaveTextContent(
      "Loading equity curve...",
    );
  });

  it("renders empty state when there are no snapshots", () => {
    render(<EquityCurve snapshots={[]} loading={false} />);

    expect(screen.getByText("No equity snapshots yet")).toBeInTheDocument();
  });

  it("renders chart when snapshots are available", () => {
    render(<EquityCurve snapshots={snapshots} loading={false} />);

    expect(screen.getByTestId("base-area-chart-mock")).toBeInTheDocument();
    expect(screen.getByTestId("base-area-chart-mock")).not.toHaveTextContent(
      "",
    );
  });
});
