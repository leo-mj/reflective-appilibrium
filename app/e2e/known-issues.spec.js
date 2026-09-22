/**
 * @fileoverview Regression tests for defects found in the browser audit.
 *
 * Most are fixed, so those assert the fixed behaviour and must pass. The ones
 * still open assert that the defect is *still there*: green while it is open,
 * red the moment it is fixed, and the failure message says which assertion
 * flipped and what to write in its place.
 *
 * They were `test.fail()` until CI showed why that cannot work here. Under
 * `test.fail()` every failure is the expected one, so the only way an open
 * defect can report anything is by *passing* — and an audit that measured
 * nothing passes too. That is what happened: the card these two are about sits
 * a couple of hundred pixels above the fold on a Mac and below it on CI's
 * fonts, axe never measured it, and CI announced "expected to fail, but passed"
 * over a defect nobody had touched. Asserting the defect directly separates the
 * two outcomes, and {@link fadedCardContrast} reports what it managed to
 * measure so "clean" and "unmeasured" can never be confused again.
 */

import { test, expect } from "@playwright/test";
import {
  gotoHome,
  loadSample,
  park,
  clickNode,
  fadedCardContrast,
} from "./helpers.js";

/**
 * Assert that a faded card is still failing AA, and that we actually looked.
 *
 * @param {{card: string|null, evaluated: number, unmeasured: number, failing: string[]}} result
 */
function stillUnderAA({ card, evaluated, unmeasured, failing }) {
  expect(
    evaluated,
    `nothing was measured — no faded card on screen, or all ${unmeasured} of its ` +
      `nodes were unmeasurable. This is not evidence the defect is fixed.`,
  ).toBeGreaterThan(0);
  expect(
    failing,
    `all ${evaluated} nodes in "${card}" now clear AA — if that is deliberate, ` +
      `this defect is fixed: assert \`expect(failing).toEqual([])\` instead, and ` +
      `drop the matching \`ignoreDimmed\` from a11y.spec.js.`,
  ).not.toEqual([]);
}

test.describe("Open defects", () => {
  test("dimmed list cards are still under AA", async ({ page }) => {
    // src/components/text_panel/TextTabCards.jsx — the "All elements" listing
    // and the cluster member cards de-emphasise with `opacity: 0.4`, which puts
    // everything inside them under AA: element id badges land at 2.81:1 and the
    // stat captions and values at 2.98:1.
    //
    // Left open deliberately. Opacity is doing real work here — it is what
    // separates the focused element from the rest — so the fix is a design
    // call about how the panel signals de-emphasis (a lighter ground, smaller
    // type, a rule), not a number to nudge.
    await gotoHome(page);
    await loadSample(page);

    // Selecting an element is what puts the rest of the list under "All
    // elements" with `dim`. Driving it this way rather than opening the
    // clusters section keeps the test deterministic — that section is
    // collapsed by default, so the dimmed cards were sometimes absent.
    await clickNode(page, "J1");
    await expect(page.locator("text=/^All elements$/i").first()).toBeVisible();
    await park(page);

    stillUnderAA(await fadedCardContrast(page, 0.4));
  });

  test("withdrawn cards are still under AA", async ({ page }) => {
    // The same defect as above at the other opacity: a withdrawn or rejected
    // element card is drawn at `opacity: 0.55` (TextTabCards.jsx), which takes
    // its id badge to 2.81:1 and its stats and action buttons to 2.98:1 —
    // everything in the card at once, whatever size the type is.
    //
    // Recorded separately because it needs no selection to reproduce: the
    // sample ships J6 withdrawn, so it is on screen from the moment the editor
    // opens. The editor audit in a11y.spec.js was clean only because the card
    // sat outside the region axe evaluates; shortening the action buttons
    // brought it into view, which is what surfaced this.
    //
    // Left open for the same reason: opacity is doing real work, and the fix is
    // a design call about how the panel signals de-emphasis — a lighter ground,
    // a rule, a muted-but-legible ink — not a number to nudge.
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    stillUnderAA(await fadedCardContrast(page, 0.55));
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

    const inks = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll("svg text")]
          .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
          .map((t) => getComputedStyle(t).fill),
      ),
    ]);
    expect(
      inks.length,
      `labels use ${inks.length} inks: ${inks.join(", ")}`,
    ).toBe(1);
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
          return {
            id: t.textContent.trim(),
            opacity: Number(getComputedStyle(g).opacity),
          };
        }),
    );
    // Elements in play sit at full group opacity whatever their confidence;
    // withdrawn and rejected ones still fade as a whole, which is intended.
    const faded = groups.filter((g) => g.opacity > 0.4 && g.opacity < 1);
    expect(
      faded,
      `partially faded label groups: ${JSON.stringify(faded)}`,
    ).toEqual([]);
  });

  test('the "↑ Top" button leaves the end of the list uncovered', async ({ page }) => {
    // Was: the jump-to-top control is painted over the scroll container at
    // bottom-left with no space reserved for it, so the last card sat under it
    // for good — scrolling could never bring it out. Fixed by padding the list
    // by TOP_BUTTON_CLEARANCE and only showing the button once there is
    // something to scroll back from (TextTab.jsx).
    //
    // What the padding guarantees is the end of the list, so that is what is
    // checked. Mid-list the button does sit over whichever card is scrolled
    // under it, and that is accepted: a floating control covers something
    // wherever it floats, and every line of every card can still be scrolled
    // clear of it. This used to scroll a fixed 1200px and pass only while that
    // happened to reach the end; taller cards moved the end, and it failed on
    // exactly that mid-list overlap.
    await gotoHome(page);
    await loadSample(page);

    // To the very end of the list's own scroll container.
    const scrolled = await page.evaluate(() => {
      let box = document.querySelector('[data-card="element"]');
      while (box && getComputedStyle(box).overflowY !== "auto") box = box.parentElement;
      if (!box || box.scrollHeight <= box.clientHeight) return false;
      box.scrollTop = box.scrollHeight;
      return true;
    });
    expect(scrolled, "no scrollable element list found").toBe(true);
    await park(page);

    const topButton = page.locator('button:text-is("↑ Top")');
    await expect(topButton).toBeVisible();

    // Geometric overlap against every line of text in the list, not only the
    // cards: at the end of the list what sits lowest is the folded section
    // headers, and a check against cards alone passed with the padding taken
    // out. Text boxes come from Range rects, so a line counts as covered only
    // where its words are. `elementsFromPoint` is no use here: it also returns
    // every ancestor of the button, which trivially "contains" the whole page.
    const covered = await page.evaluate(() => {
      const top = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "↑ Top",
      );
      const b = top.getBoundingClientRect();
      let box = document.querySelector('[data-card="element"]');
      while (box && getComputedStyle(box).overflowY !== "auto") box = box.parentElement;

      const hits = [];
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim() || top.contains(node)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const overlaps = [...range.getClientRects()].some(
          (r) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top,
        );
        if (overlaps) hits.push(node.textContent.replace(/\s+/g, " ").trim().slice(0, 60));
      }
      return hits;
    });
    expect(
      covered,
      `'↑ Top' covers list text at the end of the list: ${JSON.stringify(covered[0])}`,
    ).toEqual([]);
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

    const unnamed = await page.evaluate(
      () =>
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

  test("the confidence field in the add bar under an assist tab is labelled", async ({
    page,
  }) => {
    // Was: the numeric confidence input had no aria-label, while its own L/M/H
    // siblings did. That was in the cut-down panel the assist tabs used to carry;
    // they have the strip under them now, and this walks whatever is there.
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
    expect(unlabelled, `unlabelled fields: ${unlabelled.join(", ")}`).toEqual(
      [],
    );
  });
});
