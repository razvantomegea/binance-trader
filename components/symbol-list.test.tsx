import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTestId, symbolRowTestId } from "@/constants/data-test-id";

import { SymbolList } from "./symbol-list";

const symbols = [
  { symbol: "BTCUSDT", close: "65000.00" },
  { symbol: "ETHUSDT", close: "3500.00" },
  { symbol: "BTCBUSD", close: null },
];

describe("SymbolList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders loading state when loading with no symbols", () => {
    render(
      <SymbolList
        symbols={[]}
        selectedSymbol="BTCUSDT"
        onSelect={vi.fn()}
        loading
      />,
    );

    expect(screen.getByTestId(DataTestId.SymbolListLoading)).toHaveTextContent(
      "Loading symbols...",
    );
  });

  it("renders dash when a USDT symbol has no close price", () => {
    render(
      <SymbolList
        symbols={[{ symbol: "SOLUSDT", close: null }]}
        selectedSymbol="SOLUSDT"
        onSelect={vi.fn()}
        loading={false}
      />,
    );

    expect(screen.getByTestId(symbolRowTestId("SOLUSDT"))).toHaveTextContent(
      "—",
    );
  });

  it("renders USDT symbol rows with close prices", () => {
    render(
      <SymbolList
        symbols={symbols}
        selectedSymbol="BTCUSDT"
        onSelect={vi.fn()}
        loading={false}
      />,
    );

    expect(screen.getByTestId(symbolRowTestId("BTCUSDT"))).toBeInTheDocument();
    expect(screen.getByTestId(symbolRowTestId("ETHUSDT"))).toBeInTheDocument();
    expect(screen.getByText("65000.00")).toBeInTheDocument();
    expect(
      screen.queryByTestId(symbolRowTestId("BTCBUSD")),
    ).not.toBeInTheDocument();
  });

  it("filters symbols by search query", () => {
    render(
      <SymbolList
        symbols={symbols}
        selectedSymbol="BTCUSDT"
        onSelect={vi.fn()}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search symbol..."), {
      target: { value: "eth" },
    });

    expect(
      screen.queryByTestId(symbolRowTestId("BTCUSDT")),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(symbolRowTestId("ETHUSDT"))).toBeInTheDocument();
  });

  it("calls onSelect when a symbol row is clicked", () => {
    const onSelect = vi.fn();

    render(
      <SymbolList
        symbols={symbols}
        selectedSymbol="BTCUSDT"
        onSelect={onSelect}
        loading={false}
      />,
    );

    fireEvent.click(screen.getByTestId(symbolRowTestId("ETHUSDT")));

    expect(onSelect).toHaveBeenCalledWith("ETHUSDT");
  });

  it("highlights the selected symbol row", () => {
    render(
      <SymbolList
        symbols={symbols}
        selectedSymbol="ETHUSDT"
        onSelect={vi.fn()}
        loading={false}
      />,
    );

    expect(screen.getByTestId(symbolRowTestId("ETHUSDT"))).toHaveClass(
      "bg-zinc-100",
    );
  });
});
