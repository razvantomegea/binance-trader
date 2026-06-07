import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataTestId } from "@/constants/data-test-id";
import { installDashboardFetchMock } from "@/test/dashboard-api-fetch-mocks";

import { PriceChart } from "./price-chart";

vi.mock("./base-area-chart", () => ({
  BaseAreaChart: () => <div data-testid="base-area-chart-mock" />,
}));

describe("PriceChart", () => {
  beforeEach(() => {
    installDashboardFetchMock();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders loading state while fetching", () => {
    render(<PriceChart symbol="BTCUSDT" interval="H1" />);

    expect(screen.getByTestId(DataTestId.PriceChartLoading)).toHaveTextContent(
      "Loading chart...",
    );
  });

  it("renders chart when fetch succeeds", async () => {
    render(<PriceChart symbol="BTCUSDT" interval="H1" />);

    await waitFor(() => {
      expect(
        screen.getByTestId(DataTestId.PriceChartReady),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("base-area-chart-mock")).toBeInTheDocument();
  });

  it("renders error state when fetch fails", async () => {
    installDashboardFetchMock({ fail: { klines: 500 } });

    render(<PriceChart symbol="BTCUSDT" interval="H1" />);

    await waitFor(() => {
      expect(screen.getByTestId(DataTestId.PriceChartError)).toHaveTextContent(
        "Chart unavailable",
      );
    });
  });

  it("ignores fetch results after unmount", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<PriceChart symbol="BTCUSDT" interval="H1" />);
    unmount();

    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify({ candles: [] }), { status: 200 }),
      );
      await Promise.resolve();
    });

    expect(
      screen.queryByTestId(DataTestId.PriceChartReady),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(DataTestId.PriceChartError),
    ).not.toBeInTheDocument();
  });

  it("ignores fetch errors after unmount", async () => {
    let rejectFetch: (reason?: unknown) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<PriceChart symbol="BTCUSDT" interval="H1" />);
    unmount();

    await act(async () => {
      rejectFetch(new Error("network down"));
      await Promise.resolve();
    });

    expect(
      screen.queryByTestId(DataTestId.PriceChartError),
    ).not.toBeInTheDocument();
  });
});
