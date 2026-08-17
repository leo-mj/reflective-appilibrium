import { test, expect } from "@playwright/test";
import {
  gotoHome,
  startFresh,
  loadSample,
  addElement,
  clickNode,
  expectCounts,
  park,
} from "./helpers.js";

/**
 * How many node groups the graph has dimmed.
 *
 * Selecting an element drops everything unconnected to 0.12, so this is a
 * direct read of "the graph has re-focused on something". Withdrawn and
 * rejected nodes have their own fades (0.25, 0.35), hence the exact match
 * rather than a "less than 1" test.
 *
 * @param {import('@playwright/test').Page} page
 */
function dimmedNodeCount(page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll("svg text")]
        .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
        .filter((t) => Number(getComputedStyle(t.closest("g")).opacity).toFixed(2) === "0.12")
        .length,
  );
}

test.describe("Adding elements", () => {
  test("a fresh process carries its topic into the editor", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "obligations to future generations");
    await expect(page.locator("body")).toContainText("obligations to future generations");
    await expect(page.locator("h1")).toContainText("Round 1");
  });

  test("adding a judgment and a principle updates list, counts, and graph", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "E2E editing");

    await addElement(page, "judgment", "Deleting a stranger's data without consent is wrong.");
    await park(page);
    await expect(page.locator("body")).toContainText("Deleting a stranger's data without consent");
    await expectCounts(page, { J: 1, P: 0 });

    await addElement(page, "principle", "Consent is required before processing personal data.");
    await park(page);
    await expect(page.locator("body")).toContainText("Consent is required before processing");
    await expectCounts(page, { J: 1, P: 1 });

    // Both should now be drawn.
    const labels = await page.$$eval("svg text", (ns) =>
      ns.map((n) => n.textContent.trim()),
    );
    expect(labels).toContain("J1");
    expect(labels).toContain("P1");
  });

  test("every edit opens a new round", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Round counting");
    await expect(page.locator("h1")).toContainText("Round 1");

    await addElement(page, "judgment", "First judgment in this process.");
    await expect(page.locator("h1")).toContainText("Round 2");

    await addElement(page, "judgment", "Second judgment in this process.");
    await expect(page.locator("h1")).toContainText("Round 3");
  });
});

test.describe("Selection", () => {
  test("revising an element does not select it", async ({ page }) => {
    // Selection is the user's own pointer, and it dims the whole graph down to
    // one neighbourhood. Opening the revise modal from a card well down the
    // list used to do that too, re-focusing the graph on something the user had
    // not pointed at.
    await gotoHome(page);
    await loadSample(page);
    await park(page);
    expect(await dimmedNodeCount(page)).toBe(0);

    await page.locator('button:text-is("Revise")').first().click();
    await expect(page.locator('textarea:not([placeholder])').first()).toBeVisible();
    await park(page);

    expect(await dimmedNodeCount(page)).toBe(0);
  });

  test("clicking a node does select it", async ({ page }) => {
    // The other half of the rule: the graph still focuses when asked to. Without
    // this the test above would pass just as well on a broken selection.
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    await clickNode(page, "J1");
    await expect.poll(() => dimmedNodeCount(page)).toBeGreaterThan(0);
  });
});

test.describe("Undo and redo", () => {
  test("undo removes the last edit and redo restores it", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Undo redo");

    await addElement(page, "judgment", "A judgment that stays.");
    await addElement(page, "principle", "A principle that comes and goes.");
    await park(page);

    const undo = page.locator('button:has-text("Undo")').first();
    await expect(undo).toBeEnabled();
    await undo.click();
    await park(page);

    await expect(page.locator("body")).not.toContainText("A principle that comes and goes");
    await expect(page.locator("body")).toContainText("A judgment that stays");

    const redo = page.locator('button[aria-label="Redo"]').first();
    await expect(redo).toBeEnabled();
    await redo.click();
    await park(page);
    await expect(page.locator("body")).toContainText("A principle that comes and goes");
  });

  test("undo is disabled on an untouched process", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Nothing done yet");
    await expect(page.locator('button:has-text("Undo")').first()).toBeDisabled();
  });
});
