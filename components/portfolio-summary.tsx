import type { PortfolioResponse } from "@/types/portfolio";

import { DataTestId } from "@/constants/data-test-id";

interface PortfolioSummaryProps {
  portfolio: PortfolioResponse | null;
  loading: boolean;
}

interface PnlItemProps {
  label: string;
  value: number;
  pct: number;
  positive: boolean;
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

function SummaryMetric({
  label,
  value,
  valueTestId,
}: {
  label: string;
  value: string;
  valueTestId?: DataTestId;
}) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="font-semibold tabular-nums" data-testid={valueTestId}>
        {value}
      </p>
    </div>
  );
}

function PnlMetric({ label, value, pct, positive }: PnlItemProps) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p
        className={`font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-red-600"}`}
      >
        {signed(value, (num) => `$${formatUsd(num)}`)} (
        {signed(pct, (num) => num.toFixed(2))}
        %)
      </p>
    </div>
  );
}

function PortfolioLoadingState() {
  return (
    <div
      className="text-sm text-zinc-500"
      data-testid={DataTestId.PortfolioLoading}
    >
      Loading portfolio...
    </div>
  );
}

function PortfolioErrorState() {
  return (
    <div
      className="text-sm text-red-500"
      data-testid={DataTestId.PortfolioError}
    >
      Portfolio unavailable
    </div>
  );
}

function PortfolioSummaryContent({
  portfolio,
}: {
  portfolio: PortfolioResponse;
}) {
  const totalPositive = portfolio.totalPnl >= 0;
  const realizedPositive = portfolio.realizedPnl >= 0;
  const unrealizedPositive = portfolio.unrealizedPnl >= 0;

  return (
    <div
      className="flex flex-wrap gap-6 text-sm"
      data-testid={DataTestId.PortfolioSummary}
    >
      <SummaryMetric
        label="Cash"
        value={`$${formatUsd(portfolio.cash)}`}
        valueTestId={DataTestId.PortfolioCash}
      />
      <SummaryMetric label="Equity" value={`$${formatUsd(portfolio.equity)}`} />
      <PnlMetric
        label="Realized (closed)"
        value={portfolio.realizedPnl}
        pct={portfolio.realizedPnlPct}
        positive={realizedPositive}
      />
      <PnlMetric
        label="Unrealized (open)"
        value={portfolio.unrealizedPnl}
        pct={portfolio.unrealizedPnlPct}
        positive={unrealizedPositive}
      />
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

export function PortfolioSummary({
  portfolio,
  loading,
}: PortfolioSummaryProps) {
  if (loading && !portfolio) {
    return <PortfolioLoadingState />;
  }

  if (!portfolio) {
    return <PortfolioErrorState />;
  }

  return <PortfolioSummaryContent portfolio={portfolio} />;
}
