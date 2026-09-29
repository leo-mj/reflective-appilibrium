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

  // The rows standing directly in the menu's column were squeezed to about
  // 18px by its capped height. Now the views are tiles and the wide ☰'s rows
  // are one level down: every target is a finger's size, and the navigation
  // fits on the screen without scrolling.
  test("the ☰ menu fits the screen, with targets a finger can hit", async ({
    page,
  }) => {
    await gotoHome(page);
    await loadSample(page);
    await page.locator('button[aria-label="Menu"]').click();

    // The menu box, found from something only one of its views holds.
    const menuFrom = (id) =>
      page.locator(`[data-tutorial="${id}"]`).locator("xpath=..");
    const menu = menuFrom("menu-assist");
    const sizes = (box = menu) =>
      box.locator("button").evaluateAll((buttons) =>
        buttons.map((b) => ({
          target: b.textContent.trim(),
          height: Math.round(b.getBoundingClientRect().height),
        })),
      );

    const views = await sizes();
    expect(views.length).toBeGreaterThan(10);
    expect(views.filter((t) => t.height < 44)).toEqual([]);
    const { scrollHeight, clientHeight } = await menu.evaluate((m) => ({
      scrollHeight: m.scrollHeight,
      clientHeight: m.clientHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);

    // The tiles grow with the screen's height; on a shorter phone they shrink
    // back rather than making the menu scroll.
    await page.setViewportSize({ width: 375, height: 667 });
    const short = await menu.evaluate((m) => ({
      scrollHeight: m.scrollHeight,
      clientHeight: m.clientHeight,
    }));
    expect(short.scrollHeight).toBeLessThanOrEqual(short.clientHeight + 1);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = await sizes(menuFrom("btn-home"));
    expect(settings.length).toBeGreaterThan(8);
    expect(settings.filter((r) => r.height !== 44)).toEqual([]);
  });

  // The most the first view holds today: "All relations" on after a merge puts
  // seven tiles in Assist, a fifth line of tiles. They shrink to make room
  // rather than the menu scrolling, on the shortest screen the spec checks.
  test("the ☰ menu still fits with every view on offer", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await gotoHome(page);
    await loadSample(page);
    const burger = page.locator('button[aria-label="Menu"]');
    await burger.click();
    await page.getByRole("button", { name: "Merge", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Merge", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await burger.click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: /All relations/ }).click();
    await page.getByRole("button", { name: /Back$/ }).click();

    const menu = page.locator('[data-tutorial="menu-assist"]').locator("xpath=..");
    // Seven Assist views, and Graph, History and Clusters; Text and Merge
    // carry no tab id.
    await expect(menu.locator('[data-tutorial^="tab-"]')).toHaveCount(10);
    const { scrollHeight, clientHeight } = await menu.evaluate((m) => ({
      scrollHeight: m.scrollHeight,
      clientHeight: m.clientHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
    const heights = await menu
      .locator("button")
      .evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });

  // Fitted whole to a phone, the sample's ids were drawn at 6–7px. The graph
  // now opens no smaller than a 10px id, and the legend, which wrapped to
  // three lines above it, opens folded.
  test("the graph opens with its ids legible, under a folded legend", async ({
    page,
  }) => {
    await gotoHome(page);
    await loadSample(page);

    // Each id's size on screen: its font size times the canvas's zoom.
    const smallestId = () =>
      page.$$eval("svg text", (texts) =>
        Math.min(
          ...texts
            .filter((t) => /^[JPT]\d+$/.test(t.textContent))
            .map(
              (t) =>
                parseFloat(t.getAttribute("font-size")) * t.getScreenCTM().a,
            ),
        ),
      );
    // The view opens at zoom 1, where the smallest id is 13px; wait for the
    // fit to have come down from that before judging it.
    await expect.poll(smallestId).toBeLessThan(12.5);
    expect(await smallestId()).toBeGreaterThanOrEqual(9.9);

    const legend = page.getByRole("button", { name: /^Legend/ });
    await expect(legend).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Jointly Entails", { exact: true })).toHaveCount(0);
    await legend.click();
    await expect(page.getByText("Jointly Entails", { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
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
