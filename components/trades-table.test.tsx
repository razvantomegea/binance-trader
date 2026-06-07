import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTestId } from "@/constants/data-test-id";
import type { TradeRow } from "@/types/portfolio";

import { TradesTable } from "./trades-table";

const sampleTrade: TradeRow = {
  id: 1,
  symbol: "ETHUSDT",
  side: "SELL",
  qty: "1",
  price: "3000",
  openPrice: "2800",
  closePrice: "3000",
  maxPriceAfterBuy: "3100",
  maxPriceAfterClose24h: 3050,
  minPriceAfterClose24h: 2950,
  maxPriceAfterClose24hPct: 1.5,
  minPriceAfterClose24hPct: -0.5,
  notional: "3000",
  interval: "H1",
  candleOpenTime: "2026-06-07T09:00:00.000Z",
  reason: "trailing stop",
  createdAt: "2026-06-07T10:00:00.000Z",
  realizedPnlPct: 7.14,
};

describe("TradesTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders loading state without rows", () => {
    render(<TradesTable trades={[]} onSymbolSelect={vi.fn()} loading />);

    expect(screen.getByTestId(DataTestId.TradesLoading)).toHaveTextContent(
      "Loading trades...",
    );
  });

  it("renders error state without rows", () => {
    render(
      <TradesTable
        trades={[]}
        onSymbolSelect={vi.fn()}
        error="Failed to load trades"
      />,
    );

    expect(screen.getByText("Failed to load trades")).toBeInTheDocument();
  });

  it("renders empty state when there are no trades", () => {
    render(<TradesTable trades={[]} onSymbolSelect={vi.fn()} />);

    expect(screen.getByText("No trades yet")).toBeInTheDocument();
  });

  it("renders trade rows with side and pnl formatting", () => {
    render(<TradesTable trades={[sampleTrade]} onSymbolSelect={vi.fn()} />);

    expect(screen.getByText("SELL")).toBeInTheDocument();
    expect(screen.getByText("ETHUSDT")).toBeInTheDocument();
    expect(screen.getByText("+7.14%")).toBeInTheDocument();
    expect(screen.getByText("trailing stop")).toBeInTheDocument();
  });

  it("calls onSymbolSelect when symbol is clicked", () => {
    const onSymbolSelect = vi.fn();

    render(
      <TradesTable trades={[sampleTrade]} onSymbolSelect={onSymbolSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ETHUSDT" }));

    expect(onSymbolSelect).toHaveBeenCalledWith("ETHUSDT");
  });

  it("renders BUY side and null metric placeholders", () => {
    const buyTrade: TradeRow = {
      ...sampleTrade,
      side: "BUY",
      openPrice: null,
      closePrice: null,
      maxPriceAfterBuy: null,
      maxPriceAfterClose24hPct: null,
      minPriceAfterClose24hPct: null,
      realizedPnlPct: null,
    };

    render(<TradesTable trades={[buyTrade]} onSymbolSelect={vi.fn()} />);

    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders negative realized pnl", () => {
    render(
      <TradesTable
        trades={[{ ...sampleTrade, realizedPnlPct: -3.5 }]}
        onSymbolSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("-3.50%")).toBeInTheDocument();
  });
});
