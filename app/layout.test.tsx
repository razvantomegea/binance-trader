import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import RootLayout, { metadata } from "./layout";

describe("RootLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children inside the document body", () => {
    render(
      <RootLayout>
        <p>Dashboard child</p>
      </RootLayout>,
    );

    expect(screen.getByText("Dashboard child")).toBeInTheDocument();
    expect(document.querySelector("html")).toHaveAttribute("lang", "en");
    expect(document.querySelector("body")).toHaveClass("min-h-full");
  });

  it("exports page metadata for the trading dashboard", () => {
    expect(metadata.title).toBe("Binance Trading Dashboard");
    expect(metadata.description).toContain("paper trading");
  });
});
