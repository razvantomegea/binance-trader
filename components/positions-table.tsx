import type { PositionRow } from "@/types/portfolio";

interface PositionsTableProps {
  positions: PositionRow[];
  onSymbolSelect: (symbol: string) => void;
}

export function PositionsTable({
  positions,
  onSymbolSelect,
}: PositionsTableProps) {
  if (positions.length === 0) {
    return <p className="text-sm text-zinc-500">No open positions</p>;
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-scroll">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
            <th className="py-2 pr-3">Symbol</th>
            <th className="py-2 pr-3">Qty</th>
            <th className="py-2 pr-3">Open</th>
            <th className="py-2 pr-3">Close</th>
            <th className="py-2">P&amp;L %</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((row) => {
            const positive = (row.unrealizedPnlPct ?? 0) >= 0;
            return (
              <tr
                key={row.symbol}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => onSymbolSelect(row.symbol)}
                    className="font-medium text-left hover:text-emerald-600 hover:underline dark:hover:text-emerald-400"
                  >
                    {row.symbol}
                  </button>
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {Number(row.qty).toFixed(6)}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {Number(row.buyPrice).toFixed(6)}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {row.currentPrice ? Number(row.currentPrice).toFixed(6) : "—"}
                </td>
                <td
                  className={`py-2 tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}
                >
                  {row.unrealizedPnlPct !== null
                    ? `${positive ? "+" : ""}${row.unrealizedPnlPct.toFixed(2)}%`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
