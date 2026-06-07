import { TableFetchState } from "@/components/table-fetch-state";
import type { TradeRow } from "@/types/portfolio";

interface TradesTableProps {
  trades: TradeRow[];
  onSymbolSelect: (symbol: string) => void;
  loading?: boolean;
  error?: string | null;
}

function formatNumberOrDash(value: number | string | null): string {
  return value === null ? "—" : Number(value).toFixed(6);
}

function formatSignedPercent(value: number | string | null): string {
  if (value === null) {
    return "—";
  }
  const numeric = Number(value);
  const sign = numeric >= 0 ? "+" : "";
  return `${sign}${numeric.toFixed(2)}%`;
}

function getSideColorClass(side: TradeRow["side"]): string {
  return side === "BUY" ? "text-emerald-600" : "text-red-600";
}

function getRealizedPnlClass(value: number | string | null): string {
  if (value === null) {
    return "text-zinc-500";
  }
  return Number(value) >= 0 ? "text-emerald-600" : "text-red-600";
}

function TradesHeader() {
  return (
    <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
      <th className="whitespace-nowrap py-2 pl-4 pr-3">Time</th>
      <th className="whitespace-nowrap py-2 pr-3">Side</th>
      <th className="whitespace-nowrap py-2 pr-3">Symbol</th>
      <th className="whitespace-nowrap py-2 pr-3">Open</th>
      <th className="whitespace-nowrap py-2 pr-3">Close</th>
      <th className="whitespace-nowrap py-2 pr-3">Max After Buy</th>
      <th className="whitespace-nowrap py-2 pr-3">Max 24h After Close</th>
      <th className="whitespace-nowrap py-2 pr-3">Min 24h After Close</th>
      <th className="whitespace-nowrap py-2 pr-3">P&amp;L %</th>
      <th className="whitespace-nowrap py-2">Reason</th>
    </tr>
  );
}

function TradeRowItem({
  row,
  onSymbolSelect,
}: {
  row: TradeRow;
  onSymbolSelect: (symbol: string) => void;
}) {
  return (
    <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-900">
      <td className="py-2 pl-4 pr-3 whitespace-nowrap text-zinc-500">
        {new Date(row.createdAt).toLocaleString()}
      </td>
      <td className={`py-2 pr-3 font-medium ${getSideColorClass(row.side)}`}>
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
        {formatNumberOrDash(row.openPrice ?? null)}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
        {formatNumberOrDash(row.closePrice ?? null)}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
        {formatNumberOrDash(row.maxPriceAfterBuy)}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
        {formatSignedPercent(row.maxPriceAfterClose24hPct)}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
        {formatSignedPercent(row.minPriceAfterClose24hPct)}
      </td>
      <td
        className={`whitespace-nowrap py-2 pr-3 tabular-nums ${getRealizedPnlClass(row.realizedPnlPct)}`}
      >
        {formatSignedPercent(row.realizedPnlPct)}
      </td>
      <td className="max-w-[12rem] truncate py-2 text-zinc-500">
        {row.reason}
      </td>
    </tr>
  );
}

export function TradesTable({
  trades,
  onSymbolSelect,
  loading = false,
  error = null,
}: TradesTableProps) {
  const fetchState = TableFetchState({
    hasRows: trades.length > 0,
    loading,
    error,
    loadingText: "Loading trades...",
    emptyText: "No trades yet",
  });
  if (fetchState) {
    return fetchState;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-zinc-950">
              <TradesHeader />
            </thead>
            <tbody>
              {trades.map((row) => (
                <TradeRowItem
                  key={row.id}
                  row={row}
                  onSymbolSelect={onSymbolSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
