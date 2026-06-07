import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockPortfolio,
  mockStrategyStatus,
  mockSymbols,
  mockTrades,
} from "@/e2e/fixtures/dashboard-api-mocks";
import { STRATEGY_CRON_INTERVAL_MS } from "@/constants/cron";
import { computeNextStrategyCronRunIso } from "@/utils/scheduler/compute-next-cron-run";
import { installDashboardFetchMock } from "@/test/dashboard-api-fetch-mocks";

import {
  applyRefreshData,
  fetchAndReadDashboardData,
} from "./dashboard-data-requests";

const NOW_MS = Date.parse("2026-06-07T12:00:00.000Z");

describe("fetchAndReadDashboardData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    installDashboardFetchMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aggregates dashboard API responses", async () => {
    const result = await fetchAndReadDashboardData();

    expect(result.rows).toEqual(
      mockSymbols.symbols.map((symbol) => ({ symbol, close: null })),
    );
    expect(result.portfolioData).toEqual(mockPortfolio);
    expect(result.tradesData).toEqual(mockTrades.trades);
    expect(result.snapshotsData).toEqual([]);
    expect(result.strategyRead.status).toEqual(mockStrategyStatus);
    expect(result.strategyRead.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("returns null data for failed API responses", async () => {
    installDashboardFetchMock({
      fail: {
        symbols: 500,
        portfolio: 503,
        trades: 404,
        equityCurve: 500,
        strategyStatus: 503,
      },
    });

    const result = await fetchAndReadDashboardData();

    expect(result.rows).toBeNull();
    expect(result.portfolioData).toBeNull();
    expect(result.tradesData).toBeNull();
    expect(result.snapshotsData).toBeNull();
    expect(result.strategyRead.status).toBeNull();
    expect(result.strategyRead.error).toContain(
      "Could not fetch strategy status",
    );
  });

  it("uses unknown error when strategy status failure has empty body", async () => {
    const baseMock = installDashboardFetchMock();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/strategy/status")) {
          return new Response("", { status: 503 });
        }
        return baseMock(input);
      }),
    );

    const result = await fetchAndReadDashboardData();

    expect(result.strategyRead.error).toContain("unknown error");
  });

  it("fills next run when strategy is running without nextRunAt", async () => {
    installDashboardFetchMock({
      strategyStatus: {
        ...mockStrategyStatus,
        running: true,
        nextRunAt: null,
      },
    });

    const result = await fetchAndReadDashboardData();
    const expectedNextRun = computeNextStrategyCronRunIso(NOW_MS);

    expect(result.strategyRead.status?.nextRunAt).toBe(expectedNextRun);
    expect(
      Date.parse(result.strategyRead.status!.nextRunAt!) - NOW_MS,
    ).toBeLessThanOrEqual(STRATEGY_CRON_INTERVAL_MS);
  });
});

describe("applyRefreshData", () => {
  it("applies successful refresh data to state setters", () => {
    const setSymbolRows = vi.fn();
    const setSelectedSymbol = vi.fn();
    const setPortfolio = vi.fn();
    const setTrades = vi.fn();
    const setSnapshots = vi.fn();
    const setStrategyStatus = vi.fn();
    const setStatusRequestError = vi.fn();

    const rows = [{ symbol: "BTCUSDT", close: null }];
    const { trades } = mockTrades;
    const snapshots = [
      {
        id: 1,
        ts: "2026-06-07T10:00:00.000Z",
        cash: 1,
        equity: 2,
        interval: "H1",
      },
    ];

    applyRefreshData({
      rows,
      selectedSymbol: "ETHUSDT",
      setSelectedSymbol,
      setSymbolRows,
      portfolioData: mockPortfolio,
      setPortfolio,
      tradesData: trades,
      setTrades,
      snapshotsData: snapshots,
      setSnapshots,
      strategyRead: { status: mockStrategyStatus, error: null },
      setStrategyStatus,
      setStatusRequestError,
    });

    expect(setSymbolRows).toHaveBeenCalledWith(rows);
    expect(setSelectedSymbol).toHaveBeenCalledWith("BTCUSDT");
    expect(setPortfolio).toHaveBeenCalledWith(mockPortfolio);
    expect(setTrades).toHaveBeenCalledWith(trades);
    expect(setSnapshots).toHaveBeenCalledWith(snapshots);
    expect(setStrategyStatus).toHaveBeenCalledWith(mockStrategyStatus);
    expect(setStatusRequestError).toHaveBeenCalledWith(null);
  });

  it("reselects the first symbol when the current selection is missing", () => {
    const setSelectedSymbol = vi.fn();

    applyRefreshData({
      rows: [{ symbol: "ETHUSDT", close: null }],
      selectedSymbol: "BTCUSDT",
      setSelectedSymbol,
      setSymbolRows: vi.fn(),
      portfolioData: mockPortfolio,
      setPortfolio: vi.fn(),
      tradesData: [],
      setTrades: vi.fn(),
      snapshotsData: [],
      setSnapshots: vi.fn(),
      strategyRead: { status: mockStrategyStatus, error: null },
      setStrategyStatus: vi.fn(),
      setStatusRequestError: vi.fn(),
    });

    expect(setSelectedSymbol).toHaveBeenCalledWith("ETHUSDT");
  });

  it("skips null payloads and still applies strategy read", () => {
    const setSymbolRows = vi.fn();
    const setPortfolio = vi.fn();
    const setStrategyStatus = vi.fn();
    const setStatusRequestError = vi.fn();

    applyRefreshData({
      rows: null,
      selectedSymbol: "BTCUSDT",
      setSelectedSymbol: vi.fn(),
      setSymbolRows,
      portfolioData: null,
      setPortfolio,
      tradesData: null,
      setTrades: vi.fn(),
      snapshotsData: null,
      setSnapshots: vi.fn(),
      strategyRead: {
        status: null,
        error: "Could not fetch strategy status (503): down",
      },
      setStrategyStatus,
      setStatusRequestError,
    });

    expect(setSymbolRows).not.toHaveBeenCalled();
    expect(setPortfolio).not.toHaveBeenCalled();
    expect(setStrategyStatus).toHaveBeenCalledWith(null);
    expect(setStatusRequestError).toHaveBeenCalledWith(
      "Could not fetch strategy status (503): down",
    );
  });
});
