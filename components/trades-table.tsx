import type { TradeRow } from "@/types/portfolio";

interface TradesTableProps {
  trades: TradeRow[];
  onSymbolSelect: (symbol: string) => void;
}

export function TradesTable({ trades, onSymbolSelect }: TradesTableProps) {
  if (trades.length === 0) {
    return <p className="text-sm text-zinc-500">No trades yet</p>;
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-scroll">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
            <th className="py-2 pr-3">Time</th>
            <th className="py-2 pr-3">Side</th>
            <th className="py-2 pr-3">Symbol</th>
            <th className="py-2 pr-3">Open</th>
            <th className="py-2 pr-3">Close</th>
            <th className="py-2 pr-3">Max After Buy</th>
            <th className="py-2 pr-3">P&amp;L %</th>
            <th className="py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((row) => {
            const positive = (row.realizedPnlPct ?? 0) >= 0;
            return (
              <tr
                key={row.id}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-2 pr-3 whitespace-nowrap text-zinc-500">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td
                  className={`py-2 pr-3 font-medium ${row.side === "BUY" ? "text-emerald-600" : "text-red-600"}`}
                >
                  {row.side}
                </td>
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
                  {row.openPrice ? Number(row.openPrice).toFixed(6) : "—"}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {row.closePrice ? Number(row.closePrice).toFixed(6) : "—"}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {row.maxPriceAfterBuy !== null
                    ? Number(row.maxPriceAfterBuy).toFixed(6)
                    : "—"}
                </td>
                <td
                  className={`py-2 pr-3 tabular-nums ${row.realizedPnlPct !== null ? (positive ? "text-emerald-600" : "text-red-600") : "text-zinc-500"}`}
                >
                  {row.realizedPnlPct !== null
                    ? `${positive ? "+" : ""}${row.realizedPnlPct.toFixed(2)}%`
                    : "—"}
                </td>
                <td className="py-2 text-zinc-500">{row.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
