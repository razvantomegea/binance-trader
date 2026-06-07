import { TableFetchState } from "@/components/table-fetch-state";
import type { PositionRow } from "@/types/portfolio";

interface PositionsTableProps {
  positions: PositionRow[];
  onSymbolSelect: (symbol: string) => void;
  onClosePosition?: (symbol: string) => void | Promise<void>;
  closingSymbol?: string | null;
  loading?: boolean;
  error?: string | null;
}

function formatNumberOrDash(value: number | string | null): string {
  return value === null ? "—" : Number(value).toFixed(6);
}

function formatSignedPnl(value: number | string | null): string {
  if (value === null) {
    return "—";
  }
  const numeric = Number(value);
  const sign = numeric >= 0 ? "+" : "";
  return `${sign}${numeric.toFixed(2)}%`;
}

function getPnlColorClass(value: number | string | null): string {
  if (value === null) {
    return "text-zinc-500";
  }
  return Number(value) >= 0 ? "text-emerald-600" : "text-red-600";
}

function PositionsHeader({
  onClosePosition,
}: {
  onClosePosition?: (symbol: string) => void | Promise<void>;
}) {
  return (
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
}

function PositionRowItem({
  row,
  onSymbolSelect,
  onClosePosition,
  closingSymbol,
}: {
  row: PositionRow;
  onSymbolSelect: (symbol: string) => void;
  onClosePosition?: (symbol: string) => void | Promise<void>;
  closingSymbol: string | null;
}) {
  return (
    <tr key={row.symbol} className="border-b border-zinc-100 dark:border-zinc-900">
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
        {formatNumberOrDash(row.maxPriceAfterBuy)}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
        {formatNumberOrDash(row.currentPrice ?? null)}
      </td>
      <td
        className={`whitespace-nowrap py-2 pr-3 tabular-nums ${getPnlColorClass(row.unrealizedPnlPct)}`}
      >
        {formatSignedPnl(row.unrealizedPnlPct)}
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
}

export function PositionsTable({
  positions,
  onSymbolSelect,
  onClosePosition,
  closingSymbol = null,
  loading = false,
  error = null,
}: PositionsTableProps) {
  const fetchState = TableFetchState({
    hasRows: positions.length > 0,
    loading,
    error,
    loadingText: "Loading positions...",
    emptyText: "No open positions",
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
              <PositionsHeader onClosePosition={onClosePosition} />
            </thead>
            <tbody>
              {positions.map((row) => (
                <PositionRowItem
                  key={row.symbol}
                  row={row}
                  onSymbolSelect={onSymbolSelect}
                  onClosePosition={onClosePosition}
                  closingSymbol={closingSymbol}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
