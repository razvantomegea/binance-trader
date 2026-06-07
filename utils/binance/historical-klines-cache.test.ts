/**
 * @vitest-environment node
 */
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KlineCandle } from "@/types/binance";

const { mockMkdir, mockReaddir, mockReadFile, mockRename, mockWriteFile } =
  vi.hoisted(() => ({
    mockMkdir: vi.fn(),
    mockReaddir: vi.fn(),
    mockReadFile: vi.fn(),
    mockRename: vi.fn(),
    mockWriteFile: vi.fn(),
  }));

vi.mock("node:fs/promises", () => ({
  mkdir: mockMkdir,
  readdir: mockReaddir,
  readFile: mockReadFile,
  rename: mockRename,
  writeFile: mockWriteFile,
}));

vi.mock("@/utils/backtest-cache-root", () => ({
  getBacktestCacheRoot: () => "/cache-root",
}));

import {
  findReusableHistoricalKlinesCache,
  writeHistoricalKlinesCache,
} from "./historical-klines-cache";

function makeKline(openTime: number): KlineCandle {
  return { openTime, open: 1, high: 2, low: 0.5, close: 1.5 };
}

function validPayload(params: {
  startTime: number;
  endTime: number;
  klines: KlineCandle[];
}) {
  return {
    version: 1,
    symbol: "BTCUSDT",
    interval: "H1",
    startTime: params.startTime,
    endTime: params.endTime,
    downloadedAtIso: "2024-01-01T00:00:00.000Z",
    klines: params.klines,
  };
}

describe("historical-klines-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe("findReusableHistoricalKlinesCache", () => {
    it("returns exact cache hit by startTime", async () => {
      const klines = [makeKline(1000), makeKline(2000)];
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify(
          validPayload({ startTime: 1000, endTime: 2000, klines }),
        ),
      );

      const result = await findReusableHistoricalKlinesCache({
        symbol: "BTCUSDT",
        interval: "H1",
        startTime: 1000,
        endTime: 2000,
      });

      expect(result?.klines).toHaveLength(2);
      expect(mockReaddir).not.toHaveBeenCalled();
    });

    it("returns null when exact file is invalid", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));
      mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await findReusableHistoricalKlinesCache({
        symbol: "BTCUSDT",
        interval: "H1",
        startTime: 999_999,
        endTime: 1_000_999,
      });

      expect(result).toBeNull();
    });

    it("scores best candidate from directory listing", async () => {
      mockReadFile
        .mockRejectedValueOnce(new Error("ENOENT"))
        .mockResolvedValueOnce(
          JSON.stringify(
            validPayload({
              startTime: 0,
              endTime: 3000,
              klines: [makeKline(0), makeKline(1000), makeKline(2000)],
            }),
          ),
        );

      mockReaddir.mockResolvedValueOnce(["BTCUSDT-H1-2024-01-01-0.json"]);

      const result = await findReusableHistoricalKlinesCache({
        symbol: "BTCUSDT",
        interval: "H1",
        startTime: 1000,
        endTime: 2000,
      });

      let hasRequestedOpenTime = false;
      for (const kline of result?.klines ?? []) {
        if (kline.openTime === 1000) {
          hasRequestedOpenTime = true;
          break;
        }
      }
      expect(hasRequestedOpenTime).toBe(true);
    });

    it("ignores malformed cache files", async () => {
      mockReadFile
        .mockRejectedValueOnce(new Error("ENOENT"))
        .mockResolvedValueOnce("{not-json");

      mockReaddir.mockResolvedValueOnce(["BTCUSDT-H1-bad.json"]);

      const result = await findReusableHistoricalKlinesCache({
        symbol: "BTCUSDT",
        interval: "H1",
        startTime: 888_888,
        endTime: 889_888,
      });

      expect(result).toBeNull();
    });
  });

  describe("writeHistoricalKlinesCache", () => {
    it("writes normalized payload via temp file rename", async () => {
      const klines = [makeKline(2000), makeKline(1000)];

      await writeHistoricalKlinesCache({
        symbol: "BTCUSDT",
        interval: "H1",
        startTime: 1000,
        endTime: 2000,
        klines,
      });

      expect(mockMkdir).toHaveBeenCalledWith(
        join("/cache-root", "binance-klines"),
        { recursive: true },
      );
      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockRename).toHaveBeenCalled();

      const written = JSON.parse(String(mockWriteFile.mock.calls[0]?.[1])) as {
        klines: KlineCandle[];
      };
      const openTimes: number[] = [];
      for (const kline of written.klines) {
        openTimes.push(kline.openTime);
      }
      expect(openTimes).toEqual([1000, 2000]);
    });
  });
});
