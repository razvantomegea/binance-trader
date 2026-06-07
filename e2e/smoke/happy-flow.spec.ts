import { expect, test } from "@playwright/test";

import { DataTestId, symbolRowTestId } from "../../constants/data-test-id";
import { mockDashboardApis } from "../fixtures/dashboard-api-mocks";
import { byTestId } from "../fixtures/test-id";

test("dashboard happy path loads data and switches symbol", async ({
  page,
}) => {
  await mockDashboardApis(page);

  await page.goto("/");

  await expect(byTestId(page, DataTestId.DashboardTitle)).toBeVisible();
  await expect(byTestId(page, DataTestId.PortfolioCash)).toHaveText(
    "$10,000.00",
  );
  await expect(byTestId(page, DataTestId.PriceChartTitle)).toHaveText(
    "BTCUSDT · H1",
  );
  await expect(byTestId(page, DataTestId.PriceChartLoading)).toBeHidden();
  await expect(byTestId(page, DataTestId.PriceChartError)).toBeHidden();
  await expect(byTestId(page, DataTestId.PriceChartReady)).toBeVisible();
  await expect(byTestId(page, DataTestId.StrategyToggle)).toHaveText(
    "Start strategy",
  );
  await expect(byTestId(page, DataTestId.StrategyStatus)).toHaveText(
    "Status: Stopped",
  );

  await byTestId(page, symbolRowTestId("ETHUSDT")).click();
  await expect(byTestId(page, DataTestId.PriceChartTitle)).toHaveText(
    "ETHUSDT · H1",
  );
});
