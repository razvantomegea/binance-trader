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

  const pnlPositive = portfolio.pnlPct >= 0;

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
        <p className="text-zinc-500">P&amp;L</p>
        <p
          className={`font-semibold tabular-nums ${pnlPositive ? "text-emerald-600" : "text-red-600"}`}
        >
          {pnlPositive ? "+" : ""}
          {portfolio.pnlPct.toFixed(2)}%
        </p>
      </div>
      <div>
        <p className="text-zinc-500">Positions</p>
        <p className="font-semibold tabular-nums">{portfolio.positionCount}</p>
      </div>
    </div>
  );
}
