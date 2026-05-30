import type { PositionRow } from "@/types/portfolio";

interface PositionsTableProps {
  positions: PositionRow[];
  onSymbolSelect: (symbol: string) => void;
  onClosePosition?: (symbol: string) => void | Promise<void>;
  closingSymbol?: string | null;
  loading?: boolean;
}

export function PositionsTable({
  positions,
  onSymbolSelect,
  onClosePosition,
  closingSymbol = null,
  loading = false,
}: PositionsTableProps) {
  if (loading && positions.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading positions...</p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">No open positions</p>
      </div>
    );
  }

  const headerRow = (
    <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
      <th className="whitespace-nowrap py-2 pl-4 pr-3">Symbol</th>
      <th className="whitespace-nowrap py-2 pr-3">Qty</th>
      <th className="whitespace-nowrap py-2 pr-3">Open</th>
      <th className="whitespace-nowrap py-2 pr-3">Max After Buy</th>
      <th className="whitespace-nowrap py-2 pr-3">Current</th>
      <th className="whitespace-nowrap py-2 pr-3">P&amp;L %</th>
      {onClosePosition ? (
        <th className="whitespace-nowrap py-2">Actions</th>
      ) : null}
    </tr>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 overflow-y-auto scrollbar-gutter-stable">
            <table className="w-max min-w-full text-left text-sm">
              <thead>{headerRow}</thead>
            </table>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable">
            <table className="w-max min-w-full text-left text-sm">
              <tbody>
                {positions.map((row) => {
                  const positive = (row.unrealizedPnlPct ?? 0) >= 0;
                  return (
                    <tr
                      key={row.symbol}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-2 pl-4 pr-3">
                        <button
                          type="button"
                          onClick={() => onSymbolSelect(row.symbol)}
                          className="font-medium text-left hover:text-emerald-600 hover:underline dark:hover:text-emerald-400"
                        >
                          {row.symbol}
                        </button>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {Number(row.qty).toFixed(6)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {Number(row.buyPrice).toFixed(6)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {row.maxPriceAfterBuy !== null
                          ? Number(row.maxPriceAfterBuy).toFixed(6)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {row.currentPrice
                          ? Number(row.currentPrice).toFixed(6)
                          : "—"}
                      </td>
                      <td
                        className={`whitespace-nowrap py-2 pr-3 tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {row.unrealizedPnlPct !== null
                          ? `${positive ? "+" : ""}${row.unrealizedPnlPct.toFixed(2)}%`
                          : "—"}
                      </td>
                      {onClosePosition ? (
                        <td className="whitespace-nowrap py-2">
                          <button
                            type="button"
                            disabled={closingSymbol === row.symbol}
                            onClick={() => void onClosePosition(row.symbol)}
                            className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          >
                            {closingSymbol === row.symbol ? "Closing…" : "Close"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
