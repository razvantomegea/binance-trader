import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("@/components/dashboard/dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-mock" />,
}));

describe("Home page", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the dashboard composition root", () => {
    render(<Home />);

    expect(screen.getByTestId("dashboard-mock")).toBeInTheDocument();
  });
});
