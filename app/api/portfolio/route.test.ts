import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/portfolio/build-portfolio-response");

import { mockPortfolio } from "@/e2e/fixtures/dashboard-api-mocks";
import { buildPortfolioResponse } from "@/helpers/portfolio/build-portfolio-response";

import { GET } from "./route";

const mockedBuildPortfolioResponse = vi.mocked(buildPortfolioResponse);

describe("GET /api/portfolio", () => {
  beforeEach(() => {
    mockedBuildPortfolioResponse.mockReset();
  });

  it("returns 500 when portfolio build fails", async () => {
    mockedBuildPortfolioResponse.mockRejectedValue(new Error("db down"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load portfolio",
    });
  });

  it("returns 200 with portfolio payload", async () => {
    mockedBuildPortfolioResponse.mockResolvedValue(mockPortfolio);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(mockPortfolio);
  });
});
