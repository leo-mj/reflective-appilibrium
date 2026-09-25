import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park } from "./helpers.js";

/**
 * The Graph tab's statement view — each element drawn as a card — in a real
 * browser. The unit tests cover its logic in jsdom, which lays nothing out and
 * hit-tests nothing: whether the measured text actually fits its card, and
 * whether the pointer actually lands on one, are only answered here. Both have
 * been wrong once where every unit test passed.
 *
 * Runs under `chromium` and `mobile`; each describe skips the other.
 */

/** The pan/zoom layer inside the graph's own `<svg>` — see groups.spec.js. */
const CANVAS = 'svg > g[transform*="scale"]';
const CARD = `${CANVAS} [data-testid="statement-card"]`;
const GROWN = `${CANVAS} [data-testid="statement-card-expanded"]`;

/**
 * Switches the view on and waits for the cards to stop moving: the layout
 * underneath may still be settling, and a box measured mid-move is not one
 * the reader sees.
 *
 * @param {import('@playwright/test').Page} page
 * @param {"click"|"tap"} how
 */
async function showCards(page, how = "click") {
  const toggle = page.locator('button[aria-label="Show element text"]');
  await toggle[how]();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(CARD).first()).toBeVisible();
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await cardBoxes(page));
        const settled = now === last;
        last = now;
        return settled;
      },
      { intervals: [250, 250, 250, 500, 500, 1000], timeout: 15_000 },
    )
    .toBe(true);
}

/**
 * Each card's box on screen, off its outline.
 *
 * @param {import('@playwright/test').Page} page
 */
function cardBoxes(page) {
  return page.$$eval(CARD, (cards) =>
    cards.map((c) => {
      const r = c.querySelector(":scope > rect").getBoundingClientRect();
      return {
        id: c.querySelector("text").textContent.trim(),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }),
  );
}

/**
 * A card whose statement four lines cut short — the kind that grows.
 *
 * @param {import('@playwright/test').Page} page
 */
function cutShortCard(page) {
  return page.locator(CARD).filter({ hasText: "…" }).first();
}

test.describe("Statement cards, with a mouse", () => {
  test.skip(({ isMobile }) => isMobile, "the mouse half");

  test.beforeEach(async ({ page }) => {
    // The glide between views is the unit tests' business; here it would only
    // be something to wait out before measuring.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHome(page);
    await loadSample(page);
    await park(page);
  });

  test("draws a card for every node, and no two overlap", async ({ page }) => {
    const nodes = await page
      .locator(`${CANVAS} text`)
      .filter({ hasText: /^[JPT]\d+$/ })
      .count();
    await showCards(page);

    const boxes = await cardBoxes(page);
    expect(boxes).toHaveLength(nodes);
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        // A pixel of rounding either way is not an overlap.
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (w > 1 && h > 1) overlaps.push(`${a.id}/${b.id}`);
      }
    expect(overlaps, "cards drawn over each other").toEqual([]);
  });

  test("fits every card's text inside it, with the padding either side", async ({
    page,
  }) => {
    await showCards(page);
    // In the card's own units, where the padding is 10: the gap after the
    // longest line should match the gap before the badge. It was once the
    // text running into the border, the width estimated at a monospace's and
    // the canvas's font drawing wider.
    const gaps = await page.$$eval(CARD, (cards) =>
      cards.map((c) => {
        const box = c.querySelector(":scope > rect").getBBox();
        // A bounding box is in the element's own coordinates, before its own
        // transform — and the badge is translated into place.
        const badgeG = c.querySelector(":scope > g");
        const shift = badgeG.transform.baseVal.consolidate()?.matrix.e ?? 0;
        const badge = { x: badgeG.getBBox().x + shift };
        const wording = c.querySelector(":scope > text");
        const text = wording.getBBox();
        const ctx = new OffscreenCanvas(1, 1).getContext("2d");
        ctx.font = `14px ${getComputedStyle(document.body).fontFamily}`;
        return {
          id: c.querySelector("text").textContent.trim(),
          before: badge.x - box.x,
          after: box.x + box.width - (text.x + text.width),
          // What to look at when this fails: whether the text is drawn in the
          // font it was measured in.
          drawnIn: getComputedStyle(wording).fontFamily,
          pageFont: getComputedStyle(document.body).fontFamily,
          lines: [...wording.querySelectorAll("tspan")].map((t) => ({
            text: t.textContent,
            drawn: Math.round(t.getComputedTextLength()),
            measured: Math.round(ctx.measureText(t.textContent).width),
          })),
        };
      }),
    );
    for (const { id, before, after, ...detail } of gaps) {
      const why = `${id}: ${JSON.stringify({ before, after, ...detail })}`;
      expect(after, `text against the right border — ${why}`).toBeGreaterThan(6);
      expect(Math.abs(after - before), `uneven padding — ${why}`).toBeLessThan(5);
    }
  });

  test("grows a cut-short card under the pointer, anywhere on its wording", async ({
    page,
  }) => {
    await showCards(page);
    const card = cutShortCard(page);
    await expect(card).toHaveCount(1);
    const id = (await card.locator("text").first().textContent()).trim();

    // On the wording, which takes no pointer events itself: what answers is
    // the card's outline, filled or not. Unfilled, it answered on its border
    // alone, and a pointer on the text grew nothing.
    const words = await card.locator(":scope > text").boundingBox();
    await page.mouse.move(words.x + words.width / 2, words.y + words.height / 2);
    const grown = page.locator(GROWN);
    await expect(grown).toHaveCount(1);
    await expect(grown).not.toContainText("…");
    await expect(grown.locator("text").first()).toHaveText(id);

    await park(page);
    await expect(grown).toHaveCount(0);
  });

  test("takes a click on the grown part as a click on the card", async ({ page }) => {
    await showCards(page);
    const card = cutShortCard(page);
    const id = (await card.locator("text").first().textContent()).trim();
    const before = await card.locator(":scope > rect").boundingBox();

    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    const grown = await page.locator(`${GROWN} > rect`).boundingBox();
    expect(grown.y + grown.height).toBeGreaterThan(before.y + before.height + 8);
    // Below the card as it was, inside it as it now is.
    await page.mouse.click(
      before.x + before.width / 2,
      (before.y + before.height + grown.y + grown.height) / 2,
    );

    const pinned = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "Revise" }) })
      .filter({ hasText: new RegExp(`^${id} \\(`) })
      .last();
    await expect(pinned).toBeVisible();
  });
});

test.describe("Statement cards, with a finger", () => {
  test.skip(({ isMobile }) => !isMobile, "the touch half");

  test("a tap on a cut-short card shows its whole statement", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHome(page);
    await loadSample(page);
    await showCards(page, "tap");

    // A phone has no hover, which is what grows a card on a desktop, and the
    // details a tap opens leave the statement to the card. Either way round,
    // a finger has to be able to read the whole of it.
    const card = cutShortCard(page);
    await expect(card).toHaveCount(1);
    const words = await card.locator(":scope > text").boundingBox();
    await page.touchscreen.tap(words.x + words.width / 2, words.y + words.height / 2);

    // And stays grown. After a tap the browser emulates a mouse — including,
    // here, one moved back to where the emulated mouse last was, well off the
    // card — and that used to read as the pointer leaving it.
    const grown = page.locator(GROWN);
    await page.waitForTimeout(500);
    await expect(grown).toHaveCount(1);
    await expect(grown).not.toContainText("…");
  });
});
