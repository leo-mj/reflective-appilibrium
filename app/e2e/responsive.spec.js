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

  // An argument's premises are the widest row in the app and the only one that
  // grows while you work: each new one is another picker beside the last. Held
  // in a row that could not wrap, a third premise pushed the panel past the
  // column it sits in and the whole document scrolled sideways after it.
  test("an argument's premises wrap instead of widening the page", async ({
    page,
  }) => {
    await gotoHome(page);
    await loadSample(page);
    await page.locator('button[aria-label="Menu"]').click();
    await page.locator('[data-tutorial="tab-detectArguments"]').first().click();
    await park(page);

    // Narrow has no strip: the bar comes up as a sheet over the tab, and the
    // tab's preset is what opens it on the argument form rather than the
    // element one.
    await page.locator('button[aria-label="Add to your position"]').click();
    const sheet = page.getByRole("dialog", { name: "Add to your position" });
    await expect(sheet).toBeVisible();

    const addPremise = sheet.locator('button:text-is("+ premise")');
    await expect(addPremise).toBeVisible();
    for (let i = 0; i < 4; i++) {
      if (await addPremise.isDisabled()) break;
      await addPremise.click();
    }
    // By role: "Premise 3" alone also matches its own "Remove premise 3".
    await expect(
      page.getByRole("combobox", { name: "Premise 3" }),
    ).toBeVisible();

    await expectNoHorizontalScroll(page);
    // Nor down past the bottom of the screen, which is the other way a growing
    // row goes wrong: the sheet is capped and scrolls inside itself.
    const { scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
    // And the buttons it grew are ones a thumb can hit.
    const box = await addPremise.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(24);
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
