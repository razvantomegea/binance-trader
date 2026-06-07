import { expect, test } from "@playwright/test";

import { DataTestId } from "../../constants/data-test-id";
import { mockDashboardApis } from "../fixtures/dashboard-api-mocks";
import { byTestId } from "../fixtures/test-id";

test("dashboard shows error states when APIs fail", async ({ page }) => {
  await mockDashboardApis(page, {
    fail: { portfolio: 500, klines: 502, strategyStatus: 503 },
  });

  await page.goto("/");

  await expect(byTestId(page, DataTestId.DashboardTitle)).toBeVisible();
  await expect(byTestId(page, DataTestId.PortfolioError)).toBeVisible();
  await expect(byTestId(page, DataTestId.PriceChartError)).toBeVisible();
  await expect(byTestId(page, DataTestId.CronAlert)).toContainText(
    "Could not fetch strategy status (503)",
  );
});
