/**
 * @fileoverview How a node is drawn: its colours, and its id.
 *
 * Every node id is drawn in a single ink, and the node palette follows the
 * high-contrast switch — *not* the theme. `constants/palettes.test.js` holds
 * each palette to what it promises; these tests prove the app reaches for the
 * right one and repaints the whole graph when it changes.
 *
 * The label-size tests are here rather than in a unit test because they need
 * real font metrics — the size is capped by what the glyphs actually measure,
 * which jsdom cannot tell us.
 */

import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park, addElement, labelInks, switchMode } from "./helpers.js";

/** The node inks, as the browser reports them. */
const WHITE = "rgb(255, 255, 255)";
const BLACK = "rgb(0, 0, 0)";

test.describe("Viewing modes", () => {
  test("every id is written in one ink", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    expect(await labelInks(page)).toEqual([WHITE]);
  });

  test("white ids are bold, and the contrast mode's black ones are not", async ({ page }) => {
    // The weight is derived from the ink in constants/palettes.js rather than
    // set per component: white glyphs go fragile at 13px without it, black ones
    // go blobby with it.
    const weights = () =>
      page.evaluate(() => [
        ...new Set(
          [...document.querySelectorAll("svg text")]
            .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
            .map((t) => getComputedStyle(t).fontWeight),
        ),
      ]);

    await gotoHome(page);
    await loadSample(page);
    await park(page);
    expect(await weights()).toEqual(["700"]);

    await switchMode(page, "High-contrast", "data-contrast", "high");
    expect(await labelInks(page)).toEqual([BLACK]);
    expect(await weights()).toEqual(["400"]);
  });

  test("the theme does not change the node colours", async ({ page }) => {
    // The fills are the same on both grounds, as they were before modes
    // existed. Only the high-contrast switch changes them.
    await gotoHome(page);
    await loadSample(page);
    await park(page);
    const underDark = await nodeFills(page);

    await switchMode(page, "Dark mode", "data-theme", "light");
    expect(await nodeFills(page)).toEqual(underDark);
    expect(await labelInks(page)).toEqual([WHITE]);
  });

  test("high-contrast mode applies under either theme", async ({ page }) => {
    // One predictable set, not a variant per theme: a reader who needs it
    // should not get different colours for flipping the theme.
    await gotoHome(page);
    await loadSample(page);
    await switchMode(page, "High-contrast", "data-contrast", "high");

    const underDark = await nodeFills(page);
    await switchMode(page, "Dark mode", "data-theme", "light");
    expect(await nodeFills(page)).toEqual(underDark);
  });

  test("the legend follows the palette in force", async ({ page }) => {
    // A legend still showing the default blue while the graph is drawn in the
    // high-contrast one is worse than no legend at all.
    await gotoHome(page);
    await loadSample(page);
    await park(page);
    const before = await legendSwatches(page);

    await switchMode(page, "High-contrast", "data-contrast", "high");
    const after = await legendSwatches(page);

    expect(after.length).toBeGreaterThan(0);
    expect(after).not.toEqual(before);
  });

  test("high-contrast mode survives a reload", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await switchMode(page, "High-contrast", "data-contrast", "high");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.contrast))
      .toBe("high");
  });

  test("turning high-contrast off returns to the theme's own palette", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await park(page);
    const before = await nodeFills(page);

    await switchMode(page, "High-contrast", "data-contrast", "high");
    expect(await nodeFills(page)).not.toEqual(before);

    await switchMode(page, "High-contrast", "data-contrast", null);
    expect(await nodeFills(page)).toEqual(before);
  });
});

test.describe("Node labels", () => {
  test("every id fits inside its own shape", async ({ page }) => {
    // The label sits in the node, and the node shrinks to 65% of its base at
    // zero confidence — so the type size is capped by the smallest node, not by
    // taste. Measured from real glyph boxes; a font bump that overflows the
    // shape fails here.
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    const overflowing = await page.evaluate(() =>
      [...document.querySelectorAll("svg text")]
        .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
        .map((t) => {
          const box = t.getBBox();
          const shape = t.previousElementSibling;
          const halfH = box.height / 2;
          let avail;
          if (shape.tagName === "circle") {
            const r = Number(shape.getAttribute("r"));
            avail = 2 * Math.sqrt(Math.max(0, r * r - halfH * halfH));
          } else if (shape.tagName === "polygon") {
            // Diamond: the half-width shrinks linearly away from the centre.
            const r = Math.max(
              ...shape.getAttribute("points").split(/[ ,]/).map((n) => Math.abs(Number(n))),
            );
            avail = 2 * Math.max(0, r - halfH);
          } else {
            avail = Number(shape.getAttribute("width"));
          }
          return { id: t.textContent.trim(), width: +box.width.toFixed(1), avail: +avail.toFixed(1) };
        })
        .filter((r) => r.width > r.avail),
    );
    expect(overflowing, `labels wider than their node: ${JSON.stringify(overflowing)}`).toEqual([]);
  });

  test("a two-digit id still fits the smallest node there is", async ({ page }) => {
    // The worst case the sample does not necessarily contain: a three-character
    // id on a zero-confidence judgment, which is the tightest shape in the app.
    await gotoHome(page);
    await loadSample(page);
    for (let i = 0; i < 2; i++) {
      await addElement(page, "judgment", `Filler judgment number ${i} for id width.`);
    }
    await park(page);

    const worst = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("svg text")]
        .filter((t) => /^J\d\d/.test(t.textContent.trim()))
        .map((t) => {
          const box = t.getBBox();
          const r = Number(t.previousElementSibling.getAttribute("r"));
          const avail = 2 * Math.sqrt(Math.max(0, r * r - (box.height / 2) ** 2));
          return { id: t.textContent.trim(), slack: +(avail - box.width).toFixed(1) };
        });
      return rows.sort((a, b) => a.slack - b.slack)[0] ?? null;
    });

    expect(worst, "no two-digit judgment id on screen").not.toBeNull();
    expect(worst.slack, `${worst?.id} overflows its circle`).toBeGreaterThan(0);
  });
});

/**
 * Every node shape's fill, in document order — a fingerprint of the palette in
 * force. Compared between modes rather than pinned to hexes, so the palettes
 * stay a design decision rather than a test fixture.
 *
 * @param {import('@playwright/test').Page} page
 */
function nodeFills(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("svg text")]
      .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
      .map((t) => `${t.textContent.trim()}:${getComputedStyle(t.previousElementSibling).fill}`)
      .sort(),
  );
}

/**
 * The legend's element swatches, as rendered.
 *
 * Found by label: the legend carries no test ids, and the swatch is a bare
 * `<div>` inside the entry whose text is "Judgment", "Principle" or "Theory".
 * Several ancestors share that text — the Tooltip wraps the entry — so the
 * swatch is picked as the first descendant that actually paints something, and
 * results are keyed by label to collapse the duplicates.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
function legendSwatches(page) {
  return page.evaluate(() => {
    const byLabel = new Map();
    for (const entry of document.querySelectorAll("div")) {
      const label = entry.textContent.trim();
      if (!/^(Judgment|Principle|Theory)$/.test(label) || byLabel.has(label)) continue;
      const swatch = [...entry.querySelectorAll("div")].find((el) => {
        const s = getComputedStyle(el);
        return s.backgroundImage !== "none" || s.backgroundColor !== "rgba(0, 0, 0, 0)";
      });
      if (!swatch) continue;
      const s = getComputedStyle(swatch);
      byLabel.set(label, `${label}:${s.backgroundImage}|${s.backgroundColor}|${s.borderColor}`);
    }
    return [...byLabel.values()].sort();
  });
}
