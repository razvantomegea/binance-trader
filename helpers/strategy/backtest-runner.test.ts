import { describe, expect, it, vi } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import { getEvaluationStartOpenTime } from "@/helpers/strategy/backtest/historical-kline-provider";
import { HOUR_MS } from "@/utils/binance/candle-time";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/utils/binance/get-usdt-symbols");
vi.mock("@/utils/binance/get-klines");

import { getHistoricalClosedKlines } from "@/utils/binance/get-klines";
import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";

import {
  createDefaultBacktestConfig,
  runBacktest,
  runBacktestWithPreloadedKlines,
} from "./backtest-runner";
import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import { INITIAL_PAPER_CASH } from "@/constants/binance";

const mockedGetTradingSymbols = vi.mocked(getTradingSymbols);
const mockedGetHistoricalClosedKlines = vi.mocked(getHistoricalClosedKlines);

function makeAscendingKlines(params: {
  startOpenTime: number;
  closes: number[];
}): KlineCandle[] {
  return params.closes.map((close, index) => ({
    openTime: params.startOpenTime + index * HOUR_MS,
    open: close,
    high: close,
    low: close,
    close,
  }));
}

describe("createDefaultBacktestConfig", () => {
  it("returns defaults and applies overrides", () => {
    const config = createDefaultBacktestConfig({ days: 30, initialCash: 5000 });

    expect(config.days).toBe(30);
    expect(config.initialCash).toBe(5000);
    expect(config.interval).toBe("H1");
    expect(config.feeBps).toBe(0);
  });
});

describe("runBacktest", () => {
  it("runs deterministic simulation for one symbol", async () => {
    const fetchStart = 0;
    const closes = Array.from({ length: 48 }, (_, i) =>
      i < 24 ? 100 : i < 36 ? 160 : 240,
    );
    const klines = makeAscendingKlines({ startOpenTime: fetchStart, closes });

    mockedGetTradingSymbols.mockResolvedValue(["TESTUSDT"]);
    mockedGetHistoricalClosedKlines.mockResolvedValue(klines);

    const report = await runBacktest({
      days: 1,
      symbols: ["TESTUSDT"],
      initialCash: 10_000,
      concurrency: 1,
      feeBps: 0,
      interval: "H1",
      now: 48 * HOUR_MS + 1,
    });

    expect(report.trades.length).toBeGreaterThan(0);
    expect(report.equityCurve.length).toBeGreaterThan(0);
    expect(report.finalEquity).toBeGreaterThan(0);

    for (const trade of report.trades) {
      expect(trade).toHaveProperty("maxPriceAfterClose24h");
      expect(trade).toHaveProperty("minPriceAfterClose24hPct");
    }
  });

  it("blocks production environment", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      runBacktest({
        days: 1,
        symbols: ["TESTUSDT"],
        initialCash: 10_000,
        concurrency: 1,
        feeBps: 0,
        interval: "H1",
      }),
    ).rejects.toThrow(/localhost-only/i);

    vi.unstubAllEnvs();
  });

  it("rejects invalid configured symbols", async () => {
    await expect(
      runBacktest({
        days: 1,
        symbols: ["ETHBTC"],
        initialCash: 10_000,
        concurrency: 1,
        feeBps: 0,
        interval: "H1",
      }),
    ).rejects.toThrow(/Only USDT symbols are allowed/);
  });

  it("uses all trading symbols when symbols are omitted", async () => {
    const fetchStart = 0;
    const klines = makeAscendingKlines({
      startOpenTime: fetchStart,
      closes: Array.from({ length: 48 }, () => 100),
    });

    mockedGetTradingSymbols.mockResolvedValue(["AAAUSDT", "BBBETH"]);
    mockedGetHistoricalClosedKlines.mockResolvedValue(klines);

    await runBacktest({
      days: 1,
      initialCash: 10_000,
      concurrency: 1,
      feeBps: 0,
      interval: "H1",
      now: 48 * HOUR_MS + 1,
    });

    expect(mockedGetTradingSymbols).toHaveBeenCalledOnce();
    expect(mockedGetHistoricalClosedKlines).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAAUSDT" }),
    );
    expect(mockedGetHistoricalClosedKlines).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BBBETH" }),
    );
  });

  it("returns empty trades when klines are insufficient", async () => {
    mockedGetTradingSymbols.mockResolvedValue(["TESTUSDT"]);
    mockedGetHistoricalClosedKlines.mockResolvedValue(
      makeAscendingKlines({
        startOpenTime: 0,
        closes: Array.from({ length: 5 }, () => 100),
      }),
    );

    const report = await runBacktest({
      days: 1,
      symbols: ["TESTUSDT"],
      initialCash: 10_000,
      concurrency: 1,
      feeBps: 0,
      interval: "H1",
      now: 6 * HOUR_MS,
    });

    expect(report.trades).toEqual([]);
    expect(report.finalEquity).toBe(10_000);
  });

  it("logs preload progress when loading many symbols", async () => {
    const symbols = Array.from({ length: 50 }, (_, index) => `SYM${index}USDT`);
    const klines = makeAscendingKlines({
      startOpenTime: 0,
      closes: Array.from({ length: 48 }, () => 100),
    });

    mockedGetTradingSymbols.mockResolvedValue(symbols);
    mockedGetHistoricalClosedKlines.mockResolvedValue(klines);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runBacktest({
      days: 1,
      initialCash: 10_000,
      concurrency: 2,
      feeBps: 0,
      interval: "H1",
      now: 48 * HOUR_MS + 1,
    });

    expect(logSpy).toHaveBeenCalledWith("Preload progress: 50/50");
    logSpy.mockRestore();
  });
});

describe("runBacktestWithPreloadedKlines", () => {
  it("marks final equity from buy price when klines are missing for open symbol", async () => {
    const evalStart = getEvaluationStartOpenTime({
      rangeStartTime: 0,
      lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
    });
    const klines = makeAscendingKlines({
      startOpenTime: 0,
      closes: Array.from({ length: 48 }, (_, i) => (i < 30 ? 100 : 200)),
    });

    const report = await runBacktestWithPreloadedKlines({
      config: createDefaultBacktestConfig({
        initialCash: INITIAL_PAPER_CASH,
        strategyParams: DEFAULT_STRATEGY_PARAMS,
      }),
      symbols: ["TESTUSDT", "ALTUSDT"],
      klinesBySymbol: new Map([["TESTUSDT", klines]]),
      simulationStartTime: evalStart,
      simulationEndTime: 47 * HOUR_MS,
    });

    expect(report.finalEquity).toBeGreaterThan(0);
    expect(report.equityCurve.length).toBeGreaterThan(0);
  });

  it("skips symbols with empty kline history during simulation", async () => {
    const evalStart = getEvaluationStartOpenTime({
      rangeStartTime: 0,
      lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
    });
    const klines = makeAscendingKlines({
      startOpenTime: 0,
      closes: Array.from({ length: 48 }, (_, i) =>
        i < 24 ? 100 : i < 36 ? 160 : 240,
      ),
    });

    const report = await runBacktestWithPreloadedKlines({
      config: createDefaultBacktestConfig({
        initialCash: INITIAL_PAPER_CASH,
        strategyParams: DEFAULT_STRATEGY_PARAMS,
      }),
      symbols: ["TESTUSDT", "EMPTYUSDT"],
      klinesBySymbol: new Map([
        ["TESTUSDT", klines],
        ["EMPTYUSDT", []],
      ]),
      simulationStartTime: evalStart,
      simulationEndTime: 47 * HOUR_MS,
    });

    expect(report.trades.length).toBeGreaterThan(0);
    expect(report.trades.every((trade) => trade.symbol === "TESTUSDT")).toBe(
      true,
    );
  });
});
