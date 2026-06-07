import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTestId } from "@/constants/data-test-id";
import { mockPortfolio } from "@/e2e/fixtures/dashboard-api-mocks";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";

import { Dashboard } from "./dashboard";

vi.mock("@/components/dashboard/use-dashboard-data");
vi.mock("@/hooks/use-dashboard-header-height", () => ({
  useDashboardHeaderHeight: () => ({ current: null }),
}));
vi.mock("@/components/price-chart", () => ({
  PriceChart: () => <div data-testid="price-chart-mock" />,
}));
vi.mock("@/components/push-notification-toggle", () => ({
  PushNotificationToggle: () => <div data-testid="push-toggle-mock" />,
}));

const mockedUseDashboardData = vi.mocked(useDashboardData);

function mockDashboardData(
  overrides: Partial<ReturnType<typeof useDashboardData>> = {},
): ReturnType<typeof useDashboardData> {
  return {
    selectedSymbol: "BTCUSDT",
    symbolRows: [{ symbol: "BTCUSDT", close: "65000" }],
    portfolio: mockPortfolio,
    trades: [],
    snapshots: [],
    loadingSymbols: false,
    loadingPortfolio: false,
    strategyStatus: {
      running: false,
      runningNow: false,
      heartbeatMs: 60_000,
      startedAt: null,
      lastRunAt: null,
      nextRunAt: null,
      lastError: null,
    },
    strategyActionPending: false,
    cronAlerts: [],
    closingSymbol: null,
    closePositionError: null,
    selectUsdtSymbol: vi.fn(),
    refresh: vi.fn(),
    closePosition: vi.fn(),
    toggleStrategy: vi.fn(),
    ...overrides,
  };
}

describe("Dashboard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders dashboard shell with title and portfolio summary", () => {
    mockedUseDashboardData.mockReturnValue(mockDashboardData());

    render(<Dashboard />);

    expect(screen.getByTestId(DataTestId.Dashboard)).toBeInTheDocument();
    expect(screen.getByTestId(DataTestId.DashboardTitle)).toHaveTextContent(
      "Binance Trading Dashboard",
    );
    expect(screen.getByTestId(DataTestId.PortfolioSummary)).toBeInTheDocument();
    expect(screen.getByTestId("price-chart-mock")).toBeInTheDocument();
  });

  it("renders empty positions when portfolio is null", () => {
    mockedUseDashboardData.mockReturnValue(
      mockDashboardData({ portfolio: null }),
    );

    render(<Dashboard />);

    expect(screen.getByText("Open positions")).toBeInTheDocument();
    expect(screen.getByText("Recent trades")).toBeInTheDocument();
  });

  it("renders close position error and strategy controls", () => {
    mockedUseDashboardData.mockReturnValue(
      mockDashboardData({
        closePositionError: "Close failed for BTCUSDT",
        cronAlerts: [
          {
            id: "strategy-action-error",
            severity: "error",
            message: "Start failed",
          },
        ],
      }),
    );

    render(<Dashboard />);

    expect(screen.getByText("Close failed for BTCUSDT")).toBeInTheDocument();
    expect(screen.getByTestId(DataTestId.StrategyToggle)).toBeInTheDocument();
    expect(screen.getByTestId(DataTestId.CronAlert)).toHaveTextContent(
      "Start failed",
    );
  });
});
