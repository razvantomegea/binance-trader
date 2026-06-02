"""Analyze backtest exits and simulate trailing-stop parameters."""
from __future__ import annotations

import json
import statistics as st
import sys
from collections import Counter
from pathlib import Path


def quantile(vals: list[float], p: float) -> float:
    vals = sorted(vals)
    if not vals:
        return 0.0
    i = (len(vals) - 1) * p
    lo, hi = int(i), min(int(i) + 1, len(vals) - 1)
    frac = i - lo
    return vals[lo] * (1 - frac) + vals[hi] * frac


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "backtest-results/backtest-1780307526194.json"
    )
    o = json.loads(path.read_text(encoding="utf-8"))
    sells = [
        x
        for x in o["trades"]
        if x.get("side") == "SELL"
        and x.get("openPrice")
        and x.get("closePrice")
        and x.get("maxPriceAfterBuy")
    ]
    n = len(sells)
    if n == 0:
        print("=== SUMMARY ===")
        print("file", path.name)
        print("closed_sells", n)
        print("No valid SELL trades with open/close/maxPriceAfterBuy to analyze.")
        return

    close = [(x["closePrice"] / x["openPrice"] - 1) * 100 for x in sells]
    maxp = [(x["maxPriceAfterBuy"] / x["openPrice"] - 1) * 100 for x in sells]

    dd_rows: list[tuple[float, float, float]] = []
    for x in sells:
        op, cp, mp = x["openPrice"], x["closePrice"], x["maxPriceAfterBuy"]
        close_pct = (cp / op - 1) * 100
        trail_ref = max(op, mp)
        dd = (trail_ref - cp) / trail_ref * 100 if trail_ref else 0.0
        max_mult = trail_ref / op
        dd_rows.append((close_pct, max_mult, dd))

    print("=== SUMMARY ===")
    print("file", path.name)
    print("pnlPct", o["pnlPct"])
    print("maxDrawdownPct", o["maxDrawdownPct"])
    print("winRatePct", o["winRatePct"])
    print("totalTrades", o["totalTrades"])
    print("closed_sells", n)
    print("avg_close_pct", sum(close) / n)
    print("median_close_pct", st.median(close))
    print("avg_max_pct", sum(maxp) / n)
    print("median_max_pct", st.median(maxp))
    for label, vals in [("close", close), ("max", maxp)]:
        print(
            label + "_q",
            {k: round(quantile(vals, p), 2) for k, p in [
                ("p10", 0.1), ("p25", 0.25), ("p50", 0.5), ("p75", 0.75), ("p90", 0.9)
            ]},
        )
    for t in [5, 10, 15, 20, 25, 30, 40, 50]:
        print(f"hit_max_ge_{t}", round(sum(1 for m in maxp if m >= t) / n * 100, 2))

    print("sell_reasons", dict(Counter(x["reason"] for x in sells)))

    print("=== TRAILING STOP GRID (max(entry, peak)) ===")
    dd_best: list[tuple[float, int, float, float, float]] = []
    for d in range(3, 26):
        pnl: list[float] = []
        trig = 0
        for close_pct, max_mult, dd in dd_rows:
            if dd >= d:
                trig += 1
                pnl.append(((max_mult * (1 - d / 100)) - 1) * 100)
            else:
                pnl.append(close_pct)
        dd_best.append((sum(pnl) / n, d, trig / n * 100, sum(1 for v in pnl if v > 0) / n * 100, st.median(pnl)))
    dd_best.sort(reverse=True)
    for avg, d, trig, win, med in dd_best[:10]:
        print(f"trail={d}% trigger={trig:.1f}% avg={avg:.4f}% win={win:.2f}% med={med:.4f}%")

    for d in [5, 8, 10, 12, 15]:
        pnl = []
        trig = 0
        for close_pct, max_mult, peak_dd in dd_rows:
            if peak_dd >= d:
                trig += 1
                pnl.append(((max_mult * (1 - d / 100)) - 1) * 100)
            else:
                pnl.append(close_pct)
        print(
            f"trail={d}% trigger={trig/n*100:.1f}% avg={sum(pnl)/n:.4f}% "
            f"win={sum(1 for v in pnl if v>0)/n*100:.2f}%"
        )


if __name__ == "__main__":
    main()
