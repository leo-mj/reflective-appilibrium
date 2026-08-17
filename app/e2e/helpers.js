/**
 * @fileoverview Shared helpers for the end-to-end suite.
 *
 * Playwright gives every test a fresh browser context, so localStorage (and
 * with it the autosaved draft) starts empty in each test. Nothing here needs to
 * clear it; a test that *wants* a draft has to make one.
 *
 * @module e2e/helpers
 */

import { expect } from "@playwright/test";

/**
 * Move the pointer somewhere harmless.
 *
 * Playwright leaves the mouse wherever it last clicked, and the app opens a
 * tooltip on hover. Those tooltips sit above the panel headings, so a snapshot
 * or a text assertion taken straight after a click can read the tooltip instead
 * of the thing under it. Call this before asserting on visible text.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function park(page) {
  await page.mouse.move(4, 4);
}

/**
 * Open the landing page and wait for it to paint.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function gotoHome(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Reflective APPilibrium" })).toBeVisible();
}

/**
 * Start a blank process from the landing page and wait for the editor.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} topic
 */
export async function startFresh(page, topic) {
  // Scoped to the card that owns the topic field rather than matching "Start"
  // across the page: questionnaire cards label their own buttons, and one of
  // them being called "Start" would otherwise break every test that starts a
  // process — a failure a long way from its cause.
  const card = page.locator("div").filter({ has: page.locator('input[aria-label*="Topic"]') }).last();
  await card.locator('input[aria-label*="Topic"]').fill(topic);
  await card.getByRole("button", { name: /^Start/ }).click();
  await expect(page.locator("h1")).toContainText(/Round \d+/);
  await expect(addBar(page)).toBeVisible();
  await waitForReady(page);
}

/**
 * Wait for the editor to finish arriving.
 *
 * The app paints its content and *then* fades it in behind a full-screen
 * spinner, so elements are already queryable while the overlay still covers
 * them. Waiting on the shell reaching full opacity is the signal that the
 * spinner has gone — without it a screenshot catches the spinner and a click
 * can land on the overlay.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function waitForReady(page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const shell = document.querySelector("main");
          return shell ? getComputedStyle(shell).opacity : "0";
        }),
      // The fade is 0.6s, and every test waits on it. The default backoff would
      // often overshoot by most of a second each time, which across the suite
      // costs more than the fade itself.
      { intervals: [50, 50, 100, 100, 200, 400] },
    )
    .toBe("1");
}

/**
 * Load the built-in sample process, skipping the guided tour.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loadSample(page) {
  await page.locator('button:text-is("Skip tutorial")').click();
  // The narrow header shortens this to just "Round n", so match the part both
  // layouts share rather than the desktop wording.
  await expect(page.locator("h1")).toContainText(/Round \d+/);
  // The sample is only really "in" once its elements are drawn. The graph is
  // the one surface both layouts share — the narrow layout drops the element
  // list and its filter chips entirely — and waiting on a node label also
  // covers the force simulation having run.
  await expect(page.locator("svg text").filter({ hasText: /^J\d+$/ }).first()).toBeVisible();
  await waitForReady(page);
}

/**
 * The add bar's textarea — the only textarea on screen when no modal is open.
 *
 * @param {import('@playwright/test').Page} page
 */
export function addBar(page) {
  return page.locator("textarea").first();
}

/**
 * The revise/edit modal's textarea.
 *
 * Every other textarea in the app carries a placeholder; the modal's is the
 * only bare one, which makes the attribute a stable discriminator.
 *
 * @param {import('@playwright/test').Page} page
 */
export function modalTextarea(page) {
  return page.locator('textarea[placeholder=""], textarea:not([placeholder])');
}

/**
 * Put the add bar on its Element or Argument tab.
 *
 * Selecting a node in the graph flips the bar to the link tab on purpose, and
 * it deliberately does not flip back on deselect, so a test that adds an
 * element after touching the graph has to ask for the tab it wants.
 *
 * @param {import('@playwright/test').Page} page
 * @param {"Element"|"Argument"} tab
 */
export async function ensureAddTab(page, tab) {
  const wanted = tab === "Element" ? /Enter statement/ : /premises/;
  const current = (await addBar(page).getAttribute("placeholder")) ?? "";
  if (!wanted.test(current)) {
    await page.locator(`button:text-is("${tab}")`).click();
    await expect(addBar(page)).toHaveAttribute("placeholder", wanted);
  }
}

/**
 * Add one element through the add bar and wait for it to land.
 *
 * @param {import('@playwright/test').Page} page
 * @param {"judgment"|"principle"|"theory"} type
 * @param {string} text
 */
export async function addElement(page, type, text) {
  await ensureAddTab(page, "Element");
  await page.locator("select").first().selectOption(type);
  const ta = addBar(page);
  await ta.fill(text);
  await page.locator('button:text-is("Add")').click();
  // The bar clears itself on a successful add — a reliable "it landed" signal
  // that does not depend on where the new card renders.
  await expect(ta).toHaveValue("");
}

/**
 * Read the element-type filter chips as a map, e.g. `{ J: 14, P: 6 }`.
 *
 * Only the Analyze view renders these, so use {@link analyzeCounts} if you may
 * be on the Assist view.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Record<string, number>>}
 */
export async function chipCounts(page) {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("button")]
        .map((b) => b.textContent.trim().match(/^([JPTACL]) \((\d+)\)$/))
        .filter(Boolean)
        .map((m) => [m[1], Number(m[2])]),
    ),
  );
}

/**
 * Assert on the filter chips, waiting for the counts to settle.
 *
 * The chips are re-rendered from React state, so a bare read straight after an
 * interaction can catch the previous frame — reliably enough on a fast machine
 * to pass locally and fail on a loaded CI runner. Polling removes the race
 * without putting arbitrary sleeps in the tests.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, number>} expected - Subset of chips to match.
 */
export async function expectCounts(page, expected) {
  await expect
    .poll(async () => {
      const counts = await chipCounts(page);
      return Object.fromEntries(Object.keys(expected).map((k) => [k, counts[k]]));
    })
    .toEqual(expected);
}

/**
 * Text of every element card currently listed.
 *
 * Cards carry no test id, so they are found structurally: start at a "Revise"
 * control and climb while the parent still describes exactly one element. Every
 * card shows one "Confidence:" line, so the first ancestor holding two is the
 * list — which makes the level below it the whole card, statement included.
 * Counting rather than pattern-matching the statement keeps this working for
 * short statements, which a "longest text line" heuristic gets wrong.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function elementCardTexts(page) {
  return page.evaluate(() => {
    const cardsOf = (el) => (el.textContent.match(/Confidence:/g) ?? []).length;
    return [...document.querySelectorAll("button")]
      .filter((b) => b.textContent.trim() === "Revise")
      .map((b) => {
        let card = b;
        while (card.parentElement && cardsOf(card.parentElement) <= 1) card = card.parentElement;
        return card.innerText.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
  });
}

/**
 * Switch the main view.
 *
 * @param {import('@playwright/test').Page} page
 * @param {"Assist"|"Analyze"} view
 */
export async function showView(page, view) {
  await page.locator(`button:text-is("${view}")`).click();
  await park(page);
}

/**
 * Element counts as the Analyze view reports them, from wherever you are.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Record<string, number>>}
 */
export async function analyzeCounts(page) {
  await showView(page, "Analyze");
  return chipCounts(page);
}

/**
 * Withdraw the first element on the list, confirming the reason modal.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [reason]
 */
export async function withdrawFirst(page, reason = "") {
  await page.locator('button:text-is("Withdraw")').first().click();
  const reasonBox = page.locator('textarea[placeholder*="Reason for withdrawal"]');
  await expect(reasonBox).toBeVisible();
  if (reason) await reasonBox.fill(reason);
  // The modal renders last in the DOM, so its confirm is the last match.
  await page.locator('button:text-is("Withdraw")').last().click();
  await expect(reasonBox).toBeHidden();
}

/**
 * Revise the first element on the list.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} newText
 */
export async function reviseFirst(page, newText) {
  await page.locator('button:text-is("Revise")').first().click();
  const box = modalTextarea(page);
  await expect(box).toBeVisible();
  await box.fill(newText);
  const save = page.locator('button:text-is("Save")').last();
  await save.click();
  await expect(box).toBeHidden();
}

/**
 * Click a node in the graph by its element id.
 *
 * Clicks the shape's centre rather than the id text: the text carries
 * `pointer-events: none`, and clicking it only works while the label happens to
 * sit inside the node. The shape is the label's immediately preceding sibling
 * (GraphNode renders overlay children, then the shape, then the label), which
 * gives its centre without needing a per-type selector.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id - e.g. `"J1"`.
 */
export async function clickNode(page, id) {
  // Addressed as a locator rather than by measured coordinates: the force
  // simulation can still be settling, and a click at a point read a moment
  // earlier lands on empty canvas. Playwright's actionability check waits for
  // the element to hold still, which removes the race rather than sleeping
  // through it. XPath because the shape is the label's *preceding* sibling,
  // which CSS cannot express.
  const shape = page.locator(
    `xpath=//*[name()='text'][normalize-space(text())='${id}']/preceding-sibling::*[1]`,
  );
  await expect(shape, `no node "${id}" in the graph`).toHaveCount(1);
  await shape.click();
}

/**
 * The distinct computed fills of every node label on screen.
 *
 * One ink per node is the rule, so this should always be a single value; which
 * value it is depends on the viewing mode.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function labelInks(page) {
  return page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll("svg text")]
        .filter((t) => /^[JPT]\d+$/.test(t.textContent.trim()))
        .map((t) => getComputedStyle(t).fill),
    ),
  ]);
}

/**
 * Switch a menu toggle and wait for the document to reflect it.
 *
 * The mode lives on `<html>` — `data-theme` for the theme, `data-contrast` for
 * the accessible palette — so the attribute is the signal that the switch
 * landed, not just that the click did.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label     - Menu item text, e.g. "Light mode".
 * @param {string} attribute - e.g. "data-theme".
 * @param {string|null} value
 */
export async function switchMode(page, label, attribute, value) {
  await openMenu(page);
  await page.locator(`button:has-text("${label}")`).first().click();
  await expect
    .poll(() => page.evaluate((a) => document.documentElement.getAttribute(a), attribute))
    .toBe(value);
  await park(page);
}

/**
 * Open the ☰ settings menu, if it is not open already.
 *
 * Idempotent on purpose: the settings rows deliberately leave the menu open when
 * clicked, so a caller that switches two of them in a row would otherwise have
 * its second "open" toggle the menu shut.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function openMenu(page) {
  const exportItem = page.getByRole("button", { name: /Export/ });
  if (!(await exportItem.isVisible().catch(() => false))) {
    await page.locator('button:text-is("☰")').click();
  }
  await expect(exportItem).toBeVisible();
}

/**
 * Run axe-core against the current page and return its violations.
 *
 * axe-core is already a devDependency (the jsdom a11y test uses it), so this
 * injects that copy rather than adding @axe-core/playwright.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{id: string, impact: string, nodes: number, help: string}>>}
 */
export async function axeViolations(page) {
  await page.addScriptTag({
    path: new URL("../node_modules/axe-core/axe.min.js", import.meta.url).pathname,
  });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      help: v.help,
      // The offending markup and axe's own explanation. Without these a failure
      // says only that something is wrong, and the run that produced it is gone.
      sample: v.nodes.slice(0, 3).map((n) => ({
        html: n.html.replace(/\s+/g, " ").slice(0, 120),
        why: (n.any?.[0]?.message ?? n.all?.[0]?.message ?? "").replace(/\s+/g, " ").slice(0, 160),
      })),
    }));
  });
}
