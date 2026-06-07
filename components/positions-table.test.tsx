import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTestId } from "@/constants/data-test-id";
import type { PositionRow } from "@/types/portfolio";

import { PositionsTable } from "./positions-table";

const samplePosition: PositionRow = {
  symbol: "BTCUSDT",
  qty: "0.5",
  buyPrice: "40000",
  maxPriceAfterBuy: "42000",
  buyTime: "2026-06-07T10:00:00.000Z",
  buyTradeId: 1,
  currentPrice: "41000",
  unrealizedPnlPct: 2.5,
};

describe("PositionsTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders loading state without rows", () => {
    render(<PositionsTable positions={[]} onSymbolSelect={vi.fn()} loading />);

    expect(screen.getByTestId(DataTestId.PositionsLoading)).toHaveTextContent(
      "Loading positions...",
    );
  });

  it("renders error state without rows", () => {
    render(
      <PositionsTable
        positions={[]}
        onSymbolSelect={vi.fn()}
        error="Failed to load positions"
      />,
    );

    expect(screen.getByText("Failed to load positions")).toBeInTheDocument();
  });

  it("renders empty state when there are no positions", () => {
    render(<PositionsTable positions={[]} onSymbolSelect={vi.fn()} />);

    expect(screen.getByText("No open positions")).toBeInTheDocument();
  });

  it("renders position rows with formatted values", () => {
    render(
      <PositionsTable positions={[samplePosition]} onSymbolSelect={vi.fn()} />,
    );

    expect(screen.getByText("BTCUSDT")).toBeInTheDocument();
    expect(screen.getByText("0.500000")).toBeInTheDocument();
    expect(screen.getByText("+2.50%")).toBeInTheDocument();
  });

  it("calls onSymbolSelect when symbol is clicked", () => {
    const onSymbolSelect = vi.fn();

    render(
      <PositionsTable
        positions={[samplePosition]}
        onSymbolSelect={onSymbolSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "BTCUSDT" }));

    expect(onSymbolSelect).toHaveBeenCalledWith("BTCUSDT");
  });

  it("renders negative unrealized pnl", () => {
    render(
      <PositionsTable
        positions={[{ ...samplePosition, unrealizedPnlPct: -4.2 }]}
        onSymbolSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("-4.20%")).toBeInTheDocument();
  });

  it("renders dash when current price is null", () => {
    render(
      <PositionsTable
        positions={[{ ...samplePosition, currentPrice: null }]}
        onSymbolSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders dash for null unrealized pnl", () => {
    render(
      <PositionsTable
        positions={[{ ...samplePosition, unrealizedPnlPct: null }]}
        onSymbolSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("calls onClosePosition when close button is clicked", () => {
    const onClosePosition = vi.fn();

    render(
      <PositionsTable
        positions={[samplePosition]}
        onSymbolSelect={vi.fn()}
        onClosePosition={onClosePosition}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClosePosition).toHaveBeenCalledWith("BTCUSDT");
  });

  it("renders close action and disables while closing", () => {
    const onClosePosition = vi.fn();

    render(
      <PositionsTable
        positions={[samplePosition]}
        onSymbolSelect={vi.fn()}
        onClosePosition={onClosePosition}
        closingSymbol="BTCUSDT"
      />,
    );

    const closeButton = screen.getByRole("button", { name: "Closing…" });
    expect(closeButton).toBeDisabled();

    fireEvent.click(closeButton);
    expect(onClosePosition).not.toHaveBeenCalled();
  });
});
