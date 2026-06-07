import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataTestId } from "@/constants/data-test-id";
import { mockPortfolio } from "@/e2e/fixtures/dashboard-api-mocks";

import { PortfolioSummary } from "./portfolio-summary";

describe("PortfolioSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders loading state when loading without portfolio", () => {
    render(<PortfolioSummary portfolio={null} loading />);

    expect(screen.getByTestId(DataTestId.PortfolioLoading)).toHaveTextContent(
      "Loading portfolio...",
    );
  });

  it("renders error state when portfolio is unavailable", () => {
    render(<PortfolioSummary portfolio={null} loading={false} />);

    expect(screen.getByTestId(DataTestId.PortfolioError)).toHaveTextContent(
      "Portfolio unavailable",
    );
  });

  it("renders portfolio metrics when data is available", () => {
    render(<PortfolioSummary portfolio={mockPortfolio} loading={false} />);

    expect(screen.getByTestId(DataTestId.PortfolioSummary)).toBeInTheDocument();
    expect(screen.getByTestId(DataTestId.PortfolioCash)).toHaveTextContent(
      "$10,000.00",
    );
    expect(screen.getByText("Equity")).toBeInTheDocument();
    expect(screen.getByText("Positions")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows portfolio data while loading when stale data exists", () => {
    render(<PortfolioSummary portfolio={mockPortfolio} loading />);

    expect(screen.getByTestId(DataTestId.PortfolioSummary)).toBeInTheDocument();
    expect(
      screen.queryByTestId(DataTestId.PortfolioLoading),
    ).not.toBeInTheDocument();
  });

  it("renders negative pnl values with red styling", () => {
    render(
      <PortfolioSummary
        portfolio={{
          ...mockPortfolio,
          totalPnl: -100,
          pnlPct: -1.5,
          realizedPnl: -50,
          realizedPnlPct: -0.5,
          unrealizedPnl: -50,
          unrealizedPnlPct: -1,
        }}
        loading={false}
      />,
    );

    expect(screen.getByText(/-\$100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/-1\.50/)).toBeInTheDocument();
  });
});
