import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park, showView, elementCardTexts } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await gotoHome(page);
  await loadSample(page);
});

test.describe("Analyze tabs", () => {
  for (const tab of ["Graph", "History", "Clusters"]) {
    test(`${tab} renders without blanking the panel`, async ({ page }) => {
      await page.locator(`button:has-text("${tab}")`).click();
      await park(page);

      // Every tab keeps the header and leaves a populated right-hand panel.
      await expect(page.locator("h1")).toContainText("Reflective Equilibrium");
      const length = await page.evaluate(() => document.body.innerText.length);
      expect(length).toBeGreaterThan(200);
    });
  }

  test("Clusters draws one panel per coherent cluster", async ({ page }) => {
    await page.locator('button:has-text("Clusters")').click();
    await park(page);
    await expect(page.locator("text=/Coherent cluster \\d+/").first()).toBeVisible();
  });
});

test.describe("Filtering and search", () => {
  test("search narrows the element list and highlights matches", async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]').first();
    await search.fill("radioactive");
    await park(page);

    // The judgments chip should fall to just the matches.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const m = [...document.querySelectorAll("button")]
            .map((b) => b.textContent.trim().match(/^J \((\d+)\)$/))
            .find(Boolean);
          return m ? Number(m[1]) : null;
        }),
      )
      .toBeLessThan(14);

    // Every card still listed must be a match. Asserting card by card, rather
    // than on body text, keeps the round log out of it — the log quotes
    // statements verbatim and the search filter does not touch it.
    const cards = await elementCardTexts(page);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card, `unfiltered card left in the list: ${card.slice(0, 60)}`).toMatch(/radioactive/i);
    }

    await search.fill("");
    await park(page);
  });

  test("orders the pills: the process, then the user's filing, then the analysis", async ({
    page,
  }) => {
    // Groups are what the user has filed away; coherence is what the app makes
    // of the result, and clusters are part of that rather than a topic of their
    // own — one pill, not two.
    const labels = await page
      .locator("button[aria-label^='Jump to']")
      .evaluateAll((bs) => bs.map((b) => b.textContent.replace(/\s*\(\d+\)$/, "")));
    // No "R": the app opens showing arguments only, which titles the single
    // relations section "Arguments" and takes its pill with it.
    expect(labels).toEqual(["J", "P", "T", "A", "G", "C", "L"]);
  });

  test("reads the clusters out under the coherence heading", async ({ page }) => {
    const pill = page.getByRole("button", { name: /Jump to coherence/ });
    await pill.click();
    await park(page);
    const panel = page.locator('[data-tutorial="text-panel"]');
    await expect(panel).toContainText("Coherence");
    await expect(panel).toContainText("Cluster 1");
  });

  for (const chip of ["P", "T", "A", "C", "L"]) {
    test(`the ${chip} chip opens its section`, async ({ page }) => {
      const button = page.locator("button").filter({ hasText: new RegExp(`^${chip} \\(\\d+\\)$`) });
      await expect(button).toBeVisible();
      await button.click();
      await park(page);
      const length = await page.evaluate(() => document.body.innerText.length);
      expect(length).toBeGreaterThan(200);
    });
  }
});

test.describe("Assist view", () => {
  test("offers the workflow tabs", async ({ page }) => {
    await showView(page, "Assist");
    for (const tab of ["Judgments", "Principles", "Arguments"]) {
      await expect(page.locator(`button:text-is("${tab}")`)).toBeVisible();
    }
  });
});
