import { vi } from "vitest";

import {
  mockEquityCurve,
  mockKlines,
  mockPortfolio,
  mockStrategyStatus,
  mockSymbols,
  mockTrades,
} from "@/e2e/fixtures/dashboard-api-mocks";
import type { StrategyStatus } from "@/components/dashboard/types";

type FailMap = Partial<{
  portfolio: number;
  klines: number;
  strategyStatus: number;
  symbols: number;
  trades: number;
  equityCurve: number;
}>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number): Response {
  return jsonResponse({ error: "mock failure" }, status);
}

function matchRoute(url: string, segment: string): boolean {
  return url.includes(segment);
}

type DashboardRouteResolver = (params: {
  url: string;
  fail: FailMap;
  strategyStatus: StrategyStatus;
}) => Response | null;

function resolveSimpleRoute(params: {
  url: string;
  segment: string;
  failStatus?: number;
  body: unknown;
}): Response | null {
  if (!matchRoute(params.url, params.segment)) {
    return null;
  }
  return params.failStatus
    ? errorResponse(params.failStatus)
    : jsonResponse(params.body);
}

function resolveKlinesRoute(params: {
  url: string;
  failStatus?: number;
}): Response | null {
  if (!matchRoute(params.url, "/api/klines")) {
    return null;
  }
  if (params.failStatus) {
    return errorResponse(params.failStatus);
  }
  const parsed = new URL(params.url, "http://localhost");
  const symbol = parsed.searchParams.get("symbol") ?? mockKlines.symbol;
  return jsonResponse({ ...mockKlines, symbol });
}

const dashboardRouteResolvers: DashboardRouteResolver[] = [
  ({ url, fail }) =>
    resolveSimpleRoute({
      url,
      segment: "/api/usdt-symbols",
      failStatus: fail.symbols,
      body: mockSymbols,
    }),
  ({ url, fail }) =>
    resolveSimpleRoute({
      url,
      segment: "/api/portfolio",
      failStatus: fail.portfolio,
      body: mockPortfolio,
    }),
  ({ url, fail }) =>
    resolveSimpleRoute({
      url,
      segment: "/api/trades",
      failStatus: fail.trades,
      body: mockTrades,
    }),
  ({ url, fail }) =>
    resolveSimpleRoute({
      url,
      segment: "/api/equity-curve",
      failStatus: fail.equityCurve,
      body: mockEquityCurve,
    }),
  ({ url, fail, strategyStatus }) =>
    resolveSimpleRoute({
      url,
      segment: "/api/strategy/status",
      failStatus: fail.strategyStatus,
      body: strategyStatus,
    }),
  ({ url, fail }) => resolveKlinesRoute({ url, failStatus: fail.klines }),
  ({ url }) =>
    resolveSimpleRoute({
      url,
      segment: "/api/positions/close",
      body: { ok: true },
    }),
  ({ url }) =>
    matchRoute(url, "/api/strategy/start") ||
    matchRoute(url, "/api/strategy/stop")
      ? jsonResponse({ running: url.includes("/start") })
      : null,
];

function resolveDashboardFetch(
  url: string,
  fail: FailMap,
  strategyStatus: StrategyStatus,
): Response {
  for (const resolveRoute of dashboardRouteResolvers) {
    const response = resolveRoute({ url, fail, strategyStatus });
    if (response) {
      return response;
    }
  }
  return errorResponse(404);
}

export type DashboardFetchMock = ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

export function installDashboardFetchMock(
  options: {
    fail?: FailMap;
    strategyStatus?: StrategyStatus;
  } = {},
): DashboardFetchMock {
  const { fail = {}, strategyStatus = mockStrategyStatus } = options;

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    return resolveDashboardFetch(url, fail, strategyStatus);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
