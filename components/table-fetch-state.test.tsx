import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataTestId } from "@/constants/data-test-id";

import { TableFetchState } from "./table-fetch-state";

describe("TableFetchState", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders loading text when loading without rows", () => {
    render(
      <TableFetchState
        hasRows={false}
        loading
        loadingText="Loading trades..."
        emptyText="No trades"
        loadingTestId={DataTestId.TradesLoading}
      />,
    );

    expect(screen.getByTestId(DataTestId.TradesLoading)).toHaveTextContent(
      "Loading trades...",
    );
  });

  it("renders error text when fetch failed without rows", () => {
    render(
      <TableFetchState
        hasRows={false}
        error="Failed to load"
        loadingText="Loading trades..."
        emptyText="No trades"
      />,
    );

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("renders empty text when there are no rows", () => {
    render(
      <TableFetchState
        hasRows={false}
        loadingText="Loading trades..."
        emptyText="No trades yet"
      />,
    );

    expect(screen.getByText("No trades yet")).toBeInTheDocument();
  });

  it("renders nothing when rows are present", () => {
    const { container } = render(
      <TableFetchState
        hasRows
        loading
        error="Failed to load"
        loadingText="Loading trades..."
        emptyText="No trades"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("prefers loading over error when both are set without rows", () => {
    render(
      <TableFetchState
        hasRows={false}
        loading
        error="Failed to load"
        loadingText="Loading trades..."
        emptyText="No trades"
      />,
    );

    expect(screen.getByText("Loading trades...")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load")).not.toBeInTheDocument();
  });
});
