"""Analyze backtest exit patterns and simulate TP/DD parameters."""
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
        if x["side"] == "SELL" and x.get("openPrice") and x.get("closePrice")
    ]
    n = len(sells)
    close = [(x["closePrice"] / x["openPrice"] - 1) * 100 for x in sells]
    maxp = [(x["maxPriceAfterBuy"] / x["openPrice"] - 1) * 100 for x in sells]

    dd_rows: list[tuple[float, float, float]] = []
    for x in sells:
        op, cp, mp = x["openPrice"], x["closePrice"], x["maxPriceAfterBuy"]
        close_pct = (cp / op - 1) * 100
        max_mult = mp / op
        dd = (mp - cp) / mp * 100 if mp else 0.0
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

    print("=== TP GRID ===")
    tp_best: list[tuple[float, float, float, float]] = []
    for t_int in range(2, 81, 2):
        t = t_int / 2
        pnl = [t if m >= t else c for m, c in zip(maxp, close)]
        tp_best.append((sum(pnl) / n, t, sum(1 for v in pnl if v > 0) / n * 100, st.median(pnl)))
    tp_best.sort(reverse=True)
    for avg, t, win, med in tp_best[:8]:
        print(f"best tp={t:.1f}% avg={avg:.4f}% win={win:.2f}% med={med:.4f}%")
    for t in [5, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50]:
        pnl = [t if m >= t else c for m, c in zip(maxp, close)]
        hit = sum(1 for m in maxp if m >= t) / n * 100
        print(
            f"tp={t}% hit={hit:.1f}% avg={sum(pnl)/n:.4f}% "
            f"win={sum(1 for v in pnl if v>0)/n*100:.2f}%"
        )

    print("=== DRAWDOWN FROM PEAK ===")
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
        print(f"dd={d}% trigger={trig:.1f}% avg={avg:.4f}% win={win:.2f}% med={med:.4f}%")

    print("=== LOCK AFTER +5% ===")
    for lock in [0, 2, 3, 5, 8]:
        pnl2 = [lock if m >= 5 else c for m, c in zip(maxp, close)]
        print(
            f"touch5_exit_{lock}%: avg={sum(pnl2)/n:.4f}% "
            f"win={sum(1 for v in pnl2 if v>0)/n*100:.2f}%"
        )

    reach5 = [(m, c) for m, c in zip(maxp, close) if m >= 5]
    if reach5:
        neg = sum(1 for _, c in reach5 if c < 0)
        print(f"touched +5%: {len(reach5)} closed negative: {neg} ({neg/len(reach5)*100:.1f}%)")

    # SL proxy: cap loss at -X% (if close worse, use -X)
    print("=== STOP LOSS CAP (sim) ===")
    sl_best: list[tuple[float, int, float]] = []
    for sl in range(3, 21):
        pnl = [max(c, -sl) for c in close]
        sl_best.append((sum(pnl) / n, sl, sum(1 for v in pnl if v > 0) / n * 100))
    sl_best.sort(reverse=True)
    for avg, sl, win in sl_best[:8]:
        print(f"sl=-{sl}% avg={avg:.4f}% win={win:.2f}%")

    print("=== COMBO: DD exit + lock after +5% ===")
    combos: list[tuple[float, int, int, float]] = []
    for dd in [5, 8, 10, 12, 15]:
        for lock in [0, 2, 3, 5]:
            pnl: list[float] = []
            for close_pct, max_mult, peak_dd in dd_rows:
                m = (max_mult - 1) * 100
                if m >= 5:
                    floor = lock
                    if peak_dd >= dd:
                        exit_pct = ((max_mult * (1 - dd / 100)) - 1) * 100
                        pnl.append(max(floor, exit_pct))
                    else:
                        pnl.append(max(floor, close_pct))
                elif peak_dd >= dd:
                    pnl.append(((max_mult * (1 - dd / 100)) - 1) * 100)
                else:
                    pnl.append(close_pct)
            combos.append((sum(pnl) / n, dd, lock, sum(1 for v in pnl if v > 0) / n * 100))
    combos.sort(reverse=True)
    for avg, dd, lock, win in combos[:12]:
        print(f"dd={dd}% lock_after_5={lock}% avg={avg:.4f}% win={win:.2f}%")


if __name__ == "__main__":
    main()
