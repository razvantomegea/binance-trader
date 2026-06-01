import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function summarize(trades) {
  const sells = trades.filter(
    (t) =>
      t.side === "SELL" &&
      t.maxPriceAfterClose24hPct !== null &&
      t.minPriceAfterClose24hPct !== null,
  );

  const maxPct = sells.map((t) => t.maxPriceAfterClose24hPct);
  const minPct = sells.map((t) => t.minPriceAfterClose24hPct);

  const avg = (arr) =>
    arr.length === 0 ? null : arr.reduce((sum, v) => sum + v, 0) / arr.length;

  return {
    closedTrades: sells.length,
    avgMaxAfterClose24hPct: avg(maxPct),
    avgMinAfterClose24hPct: avg(minPct),
    medianMaxAfterClose24hPct: median(maxPct),
    medianMinAfterClose24hPct: median(minPct),
    hitRates:
      sells.length === 0
        ? {}
        : Object.fromEntries(
            [5, 10, 15, 20, 25, 30, 40, 50].map((tp) => [
              tp,
              (maxPct.filter((v) => v >= tp).length / sells.length) * 100,
            ]),
          ),
  };
}

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("Usage: node scripts/analyze-post-close-24h.mjs <backtest-json>");
  process.exit(1);
}

const raw = await readFile(resolve(reportPath), "utf8");
const report = JSON.parse(raw);
const stats = summarize(report.trades ?? []);
console.log(JSON.stringify(stats, null, 2));
