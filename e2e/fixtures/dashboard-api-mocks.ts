import type { Page, Route } from "@playwright/test";

import type { StrategyStatus } from "../../components/dashboard/types";
import type { PortfolioResponse } from "../../types/portfolio";

export const mockSymbols = { symbols: ["BTCUSDT", "ETHUSDT"] };

export const mockPortfolio: PortfolioResponse = {
  cash: 10_000,
  equity: 10_500,
  pnlPct: 5,
  totalPnl: 500,
  realizedPnl: 200,
  realizedPnlPct: 2,
  unrealizedPnl: 300,
  unrealizedPnlPct: 3,
  positionCount: 0,
  positions: [],
};

export const mockTrades = { trades: [], total: 0 };

export const mockEquityCurve = { snapshots: [] };

export const mockStrategyStatus: StrategyStatus = {
  running: false,
  runningNow: false,
  heartbeatMs: 60_000,
  startedAt: null,
  lastRunAt: null,
  nextRunAt: null,
  lastError: null,
};

export const mockKlines = {
  symbol: "BTCUSDT",
  interval: "H1" as const,
  candles: [
    {
      openTime: Date.now() - 3_600_000,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
    },
  ],
};

interface MockDashboardApiOptions {
  delayMs?: number;
  fail?: Partial<{
    portfolio: number;
    klines: number;
    strategyStatus: number;
    symbols: number;
    trades: number;
    equityCurve: number;
  }>;
}

async function maybeDelay(delayMs: number): Promise<void> {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function fulfillError(route: Route, status: number): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ error: "mock failure" }),
  });
}

export async function mockDashboardApis(
  page: Page,
  options: MockDashboardApiOptions = {},
): Promise<void> {
  const { delayMs = 0, fail = {} } = options;

  await page.route("**/api/usdt-symbols", async (route) => {
    await maybeDelay(delayMs);
    if (fail.symbols) {
      await fulfillError(route, fail.symbols);
      return;
    }
    await fulfillJson(route, mockSymbols);
  });

  await page.route("**/api/portfolio**", async (route) => {
    await maybeDelay(delayMs);
    if (fail.portfolio) {
      await fulfillError(route, fail.portfolio);
      return;
    }
    await fulfillJson(route, mockPortfolio);
  });

  await page.route("**/api/trades**", async (route) => {
    await maybeDelay(delayMs);
    if (fail.trades) {
      await fulfillError(route, fail.trades);
      return;
    }
    await fulfillJson(route, mockTrades);
  });

  await page.route("**/api/equity-curve**", async (route) => {
    await maybeDelay(delayMs);
    if (fail.equityCurve) {
      await fulfillError(route, fail.equityCurve);
      return;
    }
    await fulfillJson(route, mockEquityCurve);
  });

  await page.route("**/api/strategy/status", async (route) => {
    await maybeDelay(delayMs);
    if (fail.strategyStatus) {
      await fulfillError(route, fail.strategyStatus);
      return;
    }
    await fulfillJson(route, mockStrategyStatus);
  });

  await page.route("**/api/klines**", async (route) => {
    await maybeDelay(delayMs);
    if (fail.klines) {
      await fulfillError(route, fail.klines);
      return;
    }
    const url = new URL(route.request().url());
    const symbol = url.searchParams.get("symbol") ?? mockKlines.symbol;
    await fulfillJson(route, {
      ...mockKlines,
      symbol,
    });
  });
}
