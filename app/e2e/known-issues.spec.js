/**
 * @fileoverview Regression tests for defects found in the browser audit.
 *
 * Most are fixed, so those assert the fixed behaviour and must pass. The one
 * still open is marked `test.fail()`: Playwright expects the failure, so the
 * suite stays green while the bug is open, and turns red the moment it is
 * fixed — "expected to fail, but passed" being the signal to drop the marker
 * and keep the assertion.
 */

import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park, clickNode, axeViolations } from "./helpers.js";

test.describe("Open defects", () => {
  test("dimmed cards stay readable", async ({ page }) => {
    // src/components/text_panel/TextTabCards.jsx — the "All elements" listing
    // and the cluster member cards de-emphasise with `opacity: 0.4`, which puts
    // everything inside them under AA: element id badges land at 2.81:1 and the
    // confidence chips at 2.98:1.
    //
    // Left open deliberately. Opacity is doing real work here — it is what
    // separates the focused element from the rest — so the fix is a design
    // call about how the panel signals de-emphasis (a lighter ground, smaller
    // type, a rule), not a number to nudge.
    test.fail();

    await gotoHome(page);
    await loadSample(page);

    // Selecting an element is what puts the rest of the list under "All
    // elements" with `dim`. Driving it this way rather than opening the
    // clusters section keeps the test deterministic — that section is
    // collapsed by default, so the dimmed cards were sometimes absent and the
    // test then "passed" by having nothing to measure.
    await clickNode(page, "J1");
    await expect(page.locator("text=/^All elements$/i").first()).toBeVisible();
    await park(page);

    const contrast = (await axeViolations(page)).find((v) => v.id === "color-contrast");
    expect(contrast, `${contrast?.nodes} nodes under AA`).toBeUndefined();
  });
});

test.describe("Fixed defects", () => {
  test("every node label is the same colour", async ({ page }) => {
    // Was: labels were drawn in whichever ink contrasted better with the node's
    // own fill, so the colour changed with type and confidence and the graph
    // read as noise. They are one ink now — white on every node. Whether that
    // ink is *legible* is a property of the palette, not of this test; see the
    // ramp tests in constants/colors.test.js.
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    const inks = await page.evaluate(() =>
      [...new Set(
        [...document.querySelectorAll("svg text")]
          .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
          .map((t) => getComputedStyle(t).fill),
      )],
    );
    expect(inks.length, `labels use ${inks.length} inks: ${inks.join(", ")}`).toBe(1);
  });

  test("confidence does not fade the node", async ({ page }) => {
    // Confidence used to fade the node group, which washed the id out along
    // with the disc and capped label contrast at ~3.8:1 however the ink was
    // chosen. It rides the fill colour now, so an element in play is fully
    // opaque whatever its confidence — which is also what makes the palette
    // check in colors.test.js a statement about what reaches the screen.
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    const groups = await page.evaluate(() =>
      [...document.querySelectorAll("svg text")]
        .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
        .map((t) => {
          const g = t.closest("g");
          return { id: t.textContent.trim(), opacity: Number(getComputedStyle(g).opacity) };
        }),
    );
    // Elements in play sit at full group opacity whatever their confidence;
    // withdrawn and rejected ones still fade as a whole, which is intended.
    const faded = groups.filter((g) => g.opacity > 0.4 && g.opacity < 1);
    expect(faded, `partially faded label groups: ${JSON.stringify(faded)}`).toEqual([]);
  });

  test('the "↑ Top" button does not cover list content', async ({ page }) => {
    // Was: the jump-to-top control is painted over the scroll container at
    // bottom-left with no space reserved for it, so it sat on whichever card
    // was scrolled underneath — J5's statement in the demo, the sort toggle
    // elsewhere. Fixed by padding the list and only showing the button once
    // there is something to scroll back from (TextTab.jsx).
    await gotoHome(page);
    await loadSample(page);

    // Scroll far enough for the button to appear in the first place.
    const list = page.locator('button:text-is("Revise")').first();
    await list.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 1200);
    await park(page);

    const topButton = page.locator('button:text-is("↑ Top")');
    await expect(topButton).toBeVisible();

    // Geometric overlap against the cards themselves. `elementsFromPoint` is no
    // use here: it also returns every ancestor of the button, which trivially
    // "contains" the whole page and would report an overlap either way.
    const covered = await page.evaluate(() => {
      const top = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "↑ Top",
      );
      const b = top.getBoundingClientRect();
      const cardsOf = (el) => (el.textContent.match(/Confidence:/g) ?? []).length;
      return [...document.querySelectorAll("button")]
        .filter((x) => x.textContent.trim() === "Revise")
        .map((x) => {
          let card = x;
          while (card.parentElement && cardsOf(card.parentElement) <= 1) card = card.parentElement;
          return card;
        })
        .filter((card) => {
          const r = card.getBoundingClientRect();
          return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
        })
        .map((card) => card.innerText.replace(/\s+/g, " ").trim().slice(0, 60));
    });
    expect(covered, `'↑ Top' overlaps a card: ${JSON.stringify(covered[0])}`).toEqual([]);
  });

  test('"↑ Top" is absent until the list is scrolled', async ({ page }) => {
    // Was: shown even on an empty process, where it does nothing.
    await gotoHome(page);
    await loadSample(page);
    await park(page);
    await expect(page.locator('button:text-is("↑ Top")')).toHaveCount(0);
  });

  test("suggestion controls have accessible names", async ({ page }) => {
    // Was: Accept/Reject/Modify are icon-only buttons wrapped in a visual-only
    // Tooltip, so 42 nodes reached the accessibility tree unnamed. Fixed by
    // having Tooltip pass its text through as aria-label (Tooltip.jsx).
    await gotoHome(page);
    await loadSample(page);
    await page.locator('button:text-is("Assist")').click();
    await page.getByRole("button", { name: /Start Workflow/ }).click();
    await expect(page.locator("text=/Elicit Judgments/").first()).toBeVisible();
    await park(page);

    for (const name of ["Accept", "Reject", "Modify"]) {
      await expect(
        page.getByRole("button", { name }).first(),
        `no button named "${name}"`,
      ).toBeVisible();
    }

    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll("button")].filter(
        (b) =>
          b.offsetWidth > 0 &&
          !b.textContent.trim() &&
          !b.getAttribute("aria-label") &&
          !b.getAttribute("title"),
      ).length,
    );
    expect(unnamed, `${unnamed} buttons still have no accessible name`).toBe(0);
  });

  test("the confidence field in the workflow add panel is labelled", async ({ page }) => {
    // Was: the numeric confidence input had no aria-label, while its own L/M/H
    // siblings did (WorkflowAddPanels.jsx).
    await gotoHome(page);
    await loadSample(page);
    await page.locator('button:text-is("Assist")').click();
    await page.getByRole("button", { name: /Start Workflow/ }).click();
    await expect(page.locator("text=/Elicit Judgments/").first()).toBeVisible();
    await park(page);

    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => el.offsetWidth > 0)
        .filter(
          (el) =>
            !el.getAttribute("aria-label") &&
            !el.getAttribute("aria-labelledby") &&
            !el.getAttribute("placeholder") &&
            !(el.id && document.querySelector(`label[for="${el.id}"]`)) &&
            !el.closest("label"),
        )
        .map((el) => `${el.tagName}[type=${el.getAttribute("type") ?? "-"}]`),
    );
    expect(unlabelled, `unlabelled fields: ${unlabelled.join(", ")}`).toEqual([]);
  });
});
