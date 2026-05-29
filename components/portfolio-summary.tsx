import type { PortfolioResponse } from "@/types/portfolio";

interface PortfolioSummaryProps {
  portfolio: PortfolioResponse | null;
  loading: boolean;
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function signed(value: number, formatter: (input: number) => string): string {
  return `${value >= 0 ? "+" : "-"}${formatter(Math.abs(value))}`;
}

export function PortfolioSummary({
  portfolio,
  loading,
}: PortfolioSummaryProps) {
  if (loading && !portfolio) {
    return <div className="text-sm text-zinc-500">Loading portfolio...</div>;
  }

  if (!portfolio) {
    return <div className="text-sm text-red-500">Portfolio unavailable</div>;
  }

  const totalPositive = portfolio.totalPnl >= 0;
  const realizedPositive = portfolio.realizedPnl >= 0;
  const unrealizedPositive = portfolio.unrealizedPnl >= 0;

  return (
    <div className="flex flex-wrap gap-6 text-sm">
      <div>
        <p className="text-zinc-500">Cash</p>
        <p className="font-semibold tabular-nums">
          ${formatUsd(portfolio.cash)}
        </p>
      </div>
      <div>
        <p className="text-zinc-500">Equity</p>
        <p className="font-semibold tabular-nums">
          ${formatUsd(portfolio.equity)}
        </p>
      </div>
      <div>
        <p className="text-zinc-500">Realized (closed)</p>
        <p
          className={`font-semibold tabular-nums ${realizedPositive ? "text-emerald-600" : "text-red-600"}`}
        >
          {signed(portfolio.realizedPnl, (value) => `$${formatUsd(value)}`)} (
          {signed(portfolio.realizedPnlPct, (value) => value.toFixed(2))}%)
        </p>
      </div>
      <div>
        <p className="text-zinc-500">Unrealized (open)</p>
        <p
          className={`font-semibold tabular-nums ${unrealizedPositive ? "text-emerald-600" : "text-red-600"}`}
        >
          {signed(portfolio.unrealizedPnl, (value) => `$${formatUsd(value)}`)} (
          {signed(portfolio.unrealizedPnlPct, (value) => value.toFixed(2))}%)
        </p>
      </div>
      <div>
        <p className="text-zinc-500">Total P&amp;L</p>
        <p
          className={`font-semibold tabular-nums ${totalPositive ? "text-emerald-600" : "text-red-600"}`}
        >
          {signed(portfolio.totalPnl, (value) => `$${formatUsd(value)}`)} (
          {totalPositive ? "+" : ""}
          {portfolio.pnlPct.toFixed(2)}% )
        </p>
      </div>
      <div>
        <p className="text-zinc-500">Positions</p>
        <p className="font-semibold tabular-nums">{portfolio.positionCount}</p>
      </div>
    </div>
  );
}
