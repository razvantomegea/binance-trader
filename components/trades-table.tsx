import type { TradeRow } from "@/types/portfolio";

interface TradesTableProps {
  trades: TradeRow[];
  onSymbolSelect: (symbol: string) => void;
  loading?: boolean;
}

export function TradesTable({
  trades,
  onSymbolSelect,
  loading = false,
}: TradesTableProps) {
  if (loading && trades.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading trades...</p>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">No trades yet</p>
      </div>
    );
  }

  const headerRow = (
    <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
      <th className="whitespace-nowrap py-2 pl-4 pr-3">Time</th>
      <th className="whitespace-nowrap py-2 pr-3">Side</th>
      <th className="whitespace-nowrap py-2 pr-3">Symbol</th>
      <th className="whitespace-nowrap py-2 pr-3">Open</th>
      <th className="whitespace-nowrap py-2 pr-3">Close</th>
      <th className="whitespace-nowrap py-2 pr-3">Max After Buy</th>
      <th className="whitespace-nowrap py-2 pr-3">P&amp;L %</th>
      <th className="whitespace-nowrap py-2">Reason</th>
    </tr>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-950">
              {headerRow}
            </thead>
            <tbody>
              {trades.map((row) => {
                const positive = (row.realizedPnlPct ?? 0) >= 0;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-2 pl-4 pr-3 whitespace-nowrap text-zinc-500">
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
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                      {row.openPrice ? Number(row.openPrice).toFixed(6) : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                      {row.closePrice ? Number(row.closePrice).toFixed(6) : "—"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                      {row.maxPriceAfterBuy !== null
                        ? Number(row.maxPriceAfterBuy).toFixed(6)
                        : "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap py-2 pr-3 tabular-nums ${row.realizedPnlPct !== null ? (positive ? "text-emerald-600" : "text-red-600") : "text-zinc-500"}`}
                    >
                      {row.realizedPnlPct !== null
                        ? `${positive ? "+" : ""}${row.realizedPnlPct.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="max-w-[12rem] truncate py-2 text-zinc-500">
                      {row.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
