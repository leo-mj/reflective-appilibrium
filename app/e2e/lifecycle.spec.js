import { test, expect } from "@playwright/test";
import {
  gotoHome,
  startFresh,
  addElement,
  withdrawFirst,
  reviseFirst,
  expectCounts,
  ensureAddTab,
  addBar,
  park,
  pick,
} from "./helpers.js";

test.describe("Element lifecycle", () => {
  test("withdraw records a reason, then reinstate brings it back", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Withdraw and reinstate");
    await addElement(page, "judgment", "Breaking a promise to a friend is wrong.");

    await withdrawFirst(page, "Too absolute as stated.");
    await park(page);

    await expect(page.locator('button:text-is("Reinstate")').first()).toBeVisible();
    await expect(page.locator("body")).toContainText("Too absolute as stated");
    await expect(page.locator("body")).toContainText(/withdrawn/i);

    await page.locator('button:text-is("Reinstate")').first().click();
    await park(page);
    await expect(page.locator('button:text-is("Reinstate")')).toHaveCount(0);
    await expect(page.locator('button:text-is("Withdraw")').first()).toBeVisible();
  });

  test("revise keeps the previous wording as history", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Revising");
    await addElement(page, "judgment", "Breaking a promise to a friend is wrong.");

    await reviseFirst(page, "Breaking a promise to a friend is usually wrong.");
    await park(page);

    await expect(page.locator("body")).toContainText("usually wrong");
    await expect(page.locator("body")).toContainText(/Previously/i);
    await expect(page.locator("body")).toContainText(/revised/i);
  });

  test("an argument links premises to a conclusion", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Arguments");
    await addElement(page, "judgment", "Breaking a promise to save a life is permissible.");
    await addElement(page, "principle", "Promises must always be kept.");

    await ensureAddTab(page, "Argument");
    await expect(
      page.getByRole("combobox", { name: "Premise 1" }),
    ).toBeVisible();

    await pick(page, "Premise 1", "P1");
    await pick(page, "Argument type", "entails");
    await pick(page, "Conclusion", "J1");
    await addBar(page).fill("Universal promise-keeping yields this verdict.");
    await page.locator('button:text-is("Add")').click();
    await park(page);

    await expectCounts(page, { A: 1 });
  });
});

test.describe("History playback", () => {
  test("the slider projects the process back to earlier rounds", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "History playback");
    await addElement(page, "judgment", "The first judgment, added in round two.");
    await addElement(page, "judgment", "The second judgment, added in round three.");

    await page.locator('button:has-text("History")').click();
    await park(page);

    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // Round 0 is before anything was recorded, so nothing should be listed.
    await slider.fill("0");
    await park(page);
    await expectCounts(page, { J: 0 });

    // Round 2 is the first judgment only.
    await slider.fill("2");
    await park(page);
    await expectCounts(page, { J: 1 });
    await expect(page.locator("body")).toContainText("added in round two");
    await expect(page.locator("body")).not.toContainText("added in round three");

    // The last round is everything.
    const max = await slider.getAttribute("max");
    await slider.fill(max);
    await park(page);
    await expectCounts(page, { J: 2 });
  });
});
