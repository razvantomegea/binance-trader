import { expect, test } from "@playwright/test";

import { DataTestId } from "../../constants/data-test-id";
import { mockDashboardApis } from "../fixtures/dashboard-api-mocks";
import { byTestId } from "../fixtures/test-id";

test("dashboard shows loading states then resolves", async ({ page }) => {
  await mockDashboardApis(page, { delayMs: 3_000 });

  await page.goto("/");

  await expect(byTestId(page, DataTestId.PortfolioLoading)).toBeVisible();
  await expect(byTestId(page, DataTestId.SymbolListLoading)).toBeVisible();
  await expect(byTestId(page, DataTestId.PriceChartLoading)).toBeVisible();
  await expect(byTestId(page, DataTestId.EquityCurveLoading)).toBeVisible();
  await expect(byTestId(page, DataTestId.PositionsLoading)).toBeVisible();
  await expect(byTestId(page, DataTestId.TradesLoading)).toBeVisible();

  await expect(byTestId(page, DataTestId.PortfolioCash)).toHaveText(
    "$10,000.00",
    { timeout: 10_000 },
  );
  await expect(byTestId(page, DataTestId.StrategyToggle)).toHaveText(
    "Start strategy",
  );
  await expect(byTestId(page, DataTestId.PortfolioLoading)).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(byTestId(page, DataTestId.SymbolListLoading)).toHaveCount(0);
  await expect(byTestId(page, DataTestId.PriceChartLoading)).toHaveCount(0);
  await expect(byTestId(page, DataTestId.EquityCurveLoading)).toHaveCount(0);
  await expect(byTestId(page, DataTestId.PositionsLoading)).toHaveCount(0);
  await expect(byTestId(page, DataTestId.TradesLoading)).toHaveCount(0);
});
