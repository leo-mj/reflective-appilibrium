import { test, expect } from "@playwright/test";
import { gotoHome, analyzeCounts, park } from "./helpers.js";

/**
 * Questionnaire specs live in `src/questionnaires/`, which .gitignore excludes,
 * so a clean checkout — including every CI run — has none and the landing page
 * renders no questionnaire card. These tests therefore skip themselves rather
 * than fail when no spec is present, and give real coverage on a working copy
 * that has one.
 */
test.describe("Questionnaire mode", () => {
  test("answering every question builds the argument graph", async ({ page }) => {
    await gotoHome(page);

    // Questionnaire cards are whatever is left once the two built-in cards are
    // accounted for, so this works whichever spec is present.
    const card = page
      .locator("button")
      .filter({ hasText: /^Start / })
      .filter({ hasNotText: /^Start$/ })
      .first();
    const present = (await card.count()) > 0;
    test.skip(!present, "no questionnaire spec in src/questionnaires/ (gitignored)");

    await card.click();
    await park(page);

    const progress = page.locator("text=/\\d+ \\/ \\d+ answered/").first();
    await expect(progress).toBeVisible();
    const total = Number((await progress.textContent()).match(/\d+ \/ (\d+)/)[1]);
    expect(total).toBeGreaterThan(0);

    // Answer each question by its own heading. Question ids are not a plain
    // 1..n sequence — a spec may number one "Q4.1", between Q4 and Q5 — so read
    // the headings off the page instead of generating them.
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((e) => e.children.length === 0 && /^Q[\d.]+\.\s/.test(e.textContent.trim()))
        .map((e) => e.textContent.trim().split(/\s/)[0]),
    );
    expect(ids.length).toBe(total);

    for (const id of ids) {
      const clicked = await page.evaluate((qid) => {
        const heading = [...document.querySelectorAll("*")].find(
          (e) => e.children.length === 0 && e.textContent.trim().split(/\s/)[0] === qid,
        );
        if (!heading) return false;
        let block = heading;
        while (block && block.querySelectorAll("button").length === 0) block = block.parentElement;
        const options = block?.querySelectorAll("button");
        if (!options?.length) return false;
        options[0].click();
        return true;
      }, id);
      expect(clicked, `could not answer ${id}`).toBe(true);
    }

    await expect(progress).toHaveText(`${total} / ${total} answered`);
    await park(page);

    // Selected answers become active elements, and the pre-computed arguments
    // between them become relations.
    const counts = await analyzeCounts(page);
    expect(counts.J).toBeGreaterThan(0);
    expect(counts.A).toBeGreaterThan(0);
  });
});
