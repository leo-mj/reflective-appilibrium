import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park } from "./helpers.js";

/**
 * Runs only under the `mobile` project (iPhone 13 viewport), where the header
 * swaps to AppHeaderNarrow — a different component tree, not just a reflow.
 */
test.describe("Narrow layout", () => {
  test("the landing page fits the viewport", async ({ page }) => {
    await gotoHome(page);
    await park(page);
    await expectNoHorizontalScroll(page);
  });

  test("the editor fits the viewport and offers the menu", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    await expectNoHorizontalScroll(page);
    await expect(page.locator('button[aria-label="Menu"]')).toBeVisible();
  });
});

/**
 * A page that scrolls sideways on a phone is the classic responsive failure —
 * one element overflowing drags the whole document wider than the screen.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectNoHorizontalScroll(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `page scrolls horizontally (${scrollWidth} > ${clientWidth})`).toBeLessThanOrEqual(
    clientWidth + 1,
  );
}
