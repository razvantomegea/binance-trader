import type { Locator, Page } from "@playwright/test";

import { type DataTestId } from "../../constants/data-test-id";

export function byTestId(page: Page, testId: DataTestId | string): Locator {
  return page.getByTestId(testId);
}
