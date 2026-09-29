import { test, expect } from "@playwright/test";
import {
  gotoHome,
  loadSample,
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
    // The card's previous-wording panel, headed "Revised at step N · Previous
    // wording", with the old text under it.
    await expect(page.locator("body")).toContainText(/Previous wording/i);
    await expect(page.locator("body")).toContainText(/revised/i);
    await expect(page.locator("body")).toContainText("Breaking a promise to a friend is wrong.");
  });

  test("an argument links premises to a conclusion", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Arguments");
    await addElement(page, "judgment", "Breaking a promise to save a life is permissible.");
    await addElement(page, "principle", "Promises must always be kept.");

    await ensureAddTab(page, "Argument");
    // The tab opens on Write; this test links existing elements, which is Pick.
    await page.getByRole("button", { name: "Pick", exact: true }).click();
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

// Revising or withdrawing any premise acts on the whole argument, so a joint
// argument's card offers those once, in its header.
test.describe("A joint argument", () => {
  test("is withdrawn and reinstated from one set of actions", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    // The section opens folded; its pill unfolds it and scrolls to it.
    await page.getByRole("button", { name: /^Jump to arguments/ }).click();
    const actions = page.getByRole("group", {
      name: "Argument actions: J7, P6 to J10",
    });
    await expect(actions).toHaveCount(1);
    // The card: the nearest ancestor that also holds the conclusion's wording.
    const card = actions.locator("xpath=ancestor::div[.//b[contains(., 'Therefore')]][1]");
    await expect(card.getByRole("button", { name: "Withdraw", exact: true })).toHaveCount(1);
    await expect(card.getByRole("button", { name: "Revise", exact: true })).toHaveCount(1);

    await actions.getByRole("button", { name: "Withdraw", exact: true }).click();
    await park(page);
    await expect(card.getByRole("button", { name: "Reinstate", exact: true })).toHaveCount(1);
    await expect(card).toContainText(/withdrawn/i);

    await actions.getByRole("button", { name: "Reinstate", exact: true }).click();
    await park(page);
    await expect(card.getByRole("button", { name: "Withdraw", exact: true })).toHaveCount(1);
  });
});

test.describe("Revising an argument", () => {
  test("takes a premise out, leaving no withdrawn copy behind", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await page.getByRole("button", { name: /^Jump to arguments/ }).click();
    await page
      .getByRole("group", { name: "Argument actions: J7, P6 to J10" })
      .getByRole("button", { name: "Revise", exact: true })
      .click();

    const dialog = page.getByRole("dialog", { name: "Revise argument" });
    await expect(dialog.getByRole("textbox", { name: "Premise 2" })).toBeVisible();
    await dialog.getByRole("button", { name: "Remove premise 2" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    // One premise now, so no argument header; and the replaced joint argument
    // is the record, not something left on the board to reinstate.
    await expect(
      page.getByRole("group", { name: "Argument actions: J7, P6 to J10" }),
    ).toHaveCount(0);
    // Still four arguments: a replaced one left on the board would be a fifth.
    await expectCounts(page, { A: 4 });
  });
});

test.describe("History playback", () => {
  test("the slider projects the process back to earlier rounds", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "History playback");
    await addElement(page, "judgment", "The first judgment, added at step one.");
    await addElement(page, "judgment", "The second judgment, added at step two.");

    await page.locator('button:has-text("History")').click();
    await park(page);

    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // Step 0 is before anything was recorded, so nothing should be listed.
    await slider.fill("0");
    await park(page);
    await expectCounts(page, { J: 0 });

    // Step 1 is the first judgment only.
    await slider.fill("1");
    await park(page);
    await expectCounts(page, { J: 1 });
    await expect(page.locator("body")).toContainText("added at step one");
    await expect(page.locator("body")).not.toContainText("added at step two");

    // The last step is everything.
    const max = await slider.getAttribute("max");
    await slider.fill(max);
    await park(page);
    await expectCounts(page, { J: 2 });
  });

  test("Rounds moves the slider a round at a time", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Rounds playback");
    await addElement(page, "judgment", "Alone in the first round.");
    await page.getByRole("button", { name: "Close round" }).click();
    await addElement(page, "judgment", "First of the second round.");
    await addElement(page, "judgment", "Second of the second round.");

    await page.locator('button:has-text("History")').click();
    await park(page);
    await page.getByRole("button", { name: "Rounds", exact: true }).click();

    const slider = page.locator('input[type="range"]');
    await expect(slider).toHaveAttribute("max", "2");
    await slider.fill("1");
    await park(page);
    await expectCounts(page, { J: 1 });
    await slider.fill("2");
    await park(page);
    await expectCounts(page, { J: 3 });
  });
});
