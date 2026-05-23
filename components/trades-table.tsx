import type { TradeRow } from "@/types/portfolio";

interface TradesTableProps {
  trades: TradeRow[];
}

export function TradesTable({ trades }: TradesTableProps) {
  if (trades.length === 0) {
    return <p className="text-sm text-zinc-500">No trades yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
            <th className="py-2 pr-3">Time</th>
            <th className="py-2 pr-3">Side</th>
            <th className="py-2 pr-3">Symbol</th>
            <th className="py-2 pr-3">Price</th>
            <th className="py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((row) => (
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
              <td className="py-2 pr-3 font-medium">{row.symbol}</td>
              <td className="py-2 pr-3 tabular-nums">
                {Number(row.price).toFixed(6)}
              </td>
              <td className="py-2 text-zinc-500">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
