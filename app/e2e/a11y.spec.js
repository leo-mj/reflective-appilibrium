/**
 * @fileoverview Accessibility guard rails.
 *
 * The existing `src/a11y.test.jsx` audits components in jsdom. This audits the
 * real, fully-composed pages in a browser, which is where layout-dependent
 * rules (contrast, focus order, landmarks) actually resolve.
 *
 * `critical` and `serious` fail the build — a control assistive tech cannot
 * name, or text that cannot be read. `moderate` is logged instead: it is mostly
 * landmark coverage of every last node, and the editor's count drifts run to
 * run as the force layout settles.
 *
 * Audits run in both themes wherever the palette differs between them, which is
 * most places. A colour that clears AA on one ground routinely fails on the
 * other, in either direction.
 */

import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, axeViolations, openMenu, park } from "./helpers.js";

/**
 * Impacts that fail the build.
 *
 * `critical` is a control that cannot be operated or named by assistive tech,
 * and `serious` is text that cannot be read — both hard blocks, and both now
 * clear on every audited view. `moderate` findings (landmark coverage of every
 * last node) are logged instead: the editor's count drifts run to run as the
 * force layout settles, so it is not something to gate a build on.
 */
const BLOCKING = ["critical", "serious"];

/**
 * @param {Array<{id: string, impact: string, nodes: number}>} violations
 */
function summarise(violations) {
  return violations
    .map((v) => `${v.impact}/${v.id}×${v.nodes}`)
    .sort()
    .join(", ");
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 * @param {Object} [opts]  Forwarded to {@link axeViolations} — see `ignoreDimmed`.
 */
async function audit(page, label, opts) {
  const violations = await axeViolations(page, opts);
  console.log(`  ${label}: ${summarise(violations) || "clean"}`);
  for (const v of violations) {
    for (const n of v.sample) console.log(`    ${v.id}: ${n.why}\n      ${n.html}`);
  }
  const blocking = violations.filter((v) => BLOCKING.includes(v.impact));
  expect(blocking, `${label} — ${summarise(blocking)}`).toEqual([]);
}

/**
 * Cluster labels whose text fails AA, as axe measures them.
 *
 * Asking axe for the whole tab would also return the dimmed member cards, which
 * are a separate defect; this narrows to the nodes whose text is a cluster
 * label, so the check speaks only to the palette.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function clusterLabelsFailingContrast(page) {
  await page.addScriptTag({
    path: new URL("../node_modules/axe-core/axe.min.js", import.meta.url).pathname,
  });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ["color-contrast"] });
    return (r.violations[0]?.nodes ?? [])
      .filter((n) => /Cluster \d+|Coherent cluster/.test(n.html))
      .map((n) => (n.any?.[0]?.message ?? "").replace(/\s+/g, " ").slice(0, 110));
  });
}

/**
 * Flip one ☰ menu switch and wait for it to take.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label       The row's visible text, e.g. "Dark mode".
 * @param {Function} settled   Predicate on the resulting document state.
 */
async function toggleMenuRow(page, label, settled) {
  await openMenu(page);
  await page.locator(`button:has-text("${label}")`).click();
  await expect.poll(settled).toBe(true);
  // The settings rows deliberately leave the menu open — see openMenu — so it
  // has to be shut again, or the panel underneath swallows the next click.
  // Through the backdrop rather than the ☰ button: the backdrop is what carries
  // the close handler, and it covers the button that opened it.
  await page.mouse.click(5, 400);
  await expect(page.getByRole("button", { name: /Export/ })).toBeHidden();
  await park(page);
}

/**
 * Colour-contrast failures on the elements carrying a graph accent.
 *
 * Narrowed to `[data-accent="graph"]` rather than auditing the tab, for the
 * reason clusterLabelsFailingContrast is narrowed: a whole-tab audit also
 * returns defects that have nothing to do with the palette, and there are such
 * defects on the Arguments tab — two unnamed selects and a white-on-green badge
 * that predate this and are logged separately.
 *
 * Returns a one-item explanation rather than an empty list when the tab carries
 * no accent at all: a check with nothing to measure passes, and a passing check
 * that measured nothing is how a gate comes to be believed without ever having
 * looked at anything.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function graphAccentFailures(page) {
  await page.addScriptTag({
    path: new URL("../node_modules/axe-core/axe.min.js", import.meta.url).pathname,
  });
  return page.evaluate(async () => {
    const accents = [...document.querySelectorAll('[data-accent="graph"]')].filter(
      (el) => el.offsetWidth > 0,
    );
    if (!accents.length) return ["no header on this tab carries a graph accent"];

    const out = [];
    for (const el of accents) {
      const result = await window.axe.run(el, { runOnly: ["color-contrast"] });
      for (const violation of result.violations) {
        for (const node of violation.nodes) {
          out.push(
            `${node.html.replace(/\s+/g, " ").slice(0, 50)} — ` +
              (node.any?.[0]?.message ?? "").replace(/\s+/g, " ").slice(0, 110),
          );
        }
      }
    }
    return out;
  });
}

test.describe("Accessibility", () => {
  test("the landing page is clean in both themes", async ({ page }) => {
    await gotoHome(page);
    await park(page);
    await audit(page, "home/dark");

    // The palette is theme-dependent, and several colours that pass on one
    // ground fail on the other — the edge teal reads 6.03:1 on the dark panel
    // and 2.22:1 on the light one. Auditing one theme only would miss that.
    await page.click('button[title*="Switch to"]');
    await park(page);
    await audit(page, "home/light");
  });

  test("the editor is clean in both themes", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await park(page);
    // Dimmed cards excluded, for the same reason the cluster-label check below
    // narrows itself: a withdrawn card is drawn at `opacity: 0.55`, which puts
    // its badge, chips and buttons under AA together. That is the open defect in
    // known-issues.spec.js and a design call about how the panel signals
    // de-emphasis. This view was clean only by accident before — the card sat
    // outside the region axe evaluates, and any layout change that brought it
    // back in would have surfaced it. Contrast outside a faded ancestor, and
    // every other rule, still fail here.
    // Graph accents excluded for the reason the assist audit below excludes
    // them, and likewise only in the default mode: every add button — the bar's,
    // its lit tab, and the assist panels' three — is filled with the supports
    // teal exactly and written in the palette's own ink, which is white here at
    // 2.43:1, the same bargain the node ramp strikes. In high-contrast mode that
    // ink is black on the same fill and clears AAA; the unit tests beside those
    // components hold them to taking the mode's ink rather than a hex of their
    // own, and the high-contrast test below walks the same attribute.
    await audit(page, "editor/dark", { ignoreDimmed: true, ignoreGraphAccents: true });
  });

  test("cluster labels are readable in both themes", async ({ page }) => {
    // The cluster tints are a categorical palette used as label text, and had
    // never been audited — four of the six failed AA on each theme, and not the
    // same four. Scoped to the labels rather than the whole tab: the dimmed
    // member cards on this tab have a separate, older problem, recorded in
    // known-issues.spec.js.
    await gotoHome(page);
    await loadSample(page);
    await page.locator('button:has-text("Clusters")').click();
    await expect(page.locator("text=/Coherent cluster/").first()).toBeVisible();
    await park(page);

    for (const theme of ["dark", "light"]) {
      const offenders = await clusterLabelsFailingContrast(page);
      console.log(`  clusters/${theme}: ${offenders.length || "all labels clear"}`);
      expect(offenders, `unreadable cluster labels: ${offenders.join(" | ")}`).toEqual([]);

      if (theme === "dark") {
        await openMenu(page);
        // The row names the setting, not the change: "Dark mode" with its
        // switch on is what the dark theme looks like from here.
        await page.locator('button:has-text("Dark mode")').click();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
          .toBe("light");
        await park(page);
      }
    }
  });

  test("the assist workflow is clean", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await page.locator('button:text-is("Assist")').click();
    await page.getByRole("button", { name: /Start Workflow/ }).click();
    await expect(page.locator("text=/Elicit Judgments/").first()).toBeVisible();
    await park(page);
    // Graph accents excluded, and only here in the default mode. An assist tab's
    // header takes its element or relation colour from the graph *exactly* — the
    // judgment blue reads 2.83:1 as 12px type on the dark panel — which is the
    // same decision the node ramp already embodies. The compliant path is
    // high-contrast mode, and the test below is what holds it to that.
    await audit(page, "assist", { ignoreGraphAccents: true });
  });

  test("every assist tab header clears AA in high-contrast mode", async ({ page }) => {
    // The promise the design actually makes. Each header wears the graph
    // constant for what its tab produces, taken exactly, and several of those
    // are under AA as type in the default mode — deliberately, by the same
    // reasoning as the node ramp. High-contrast mode is where that stops being
    // acceptable, so there the header sits on a chip, and this is what proves
    // the chip does its job. Both themes, because the chip is applied in both.
    await gotoHome(page);
    await loadSample(page);
    await page.locator('button:text-is("Assist")').click();
    await toggleMenuRow(page, "High-contrast", () =>
      page.evaluate(() => document.documentElement.dataset.contrast === "high"),
    );
    // Relations is hidden while the entails-only filter is on, which it is by
    // default — so its header is unreachable, and untested, without this.
    await toggleMenuRow(page, "All relations", () =>
      page.locator('button:text-is("Relations")').isVisible(),
    );

    for (const theme of ["dark", "light"]) {
      for (const tab of [
        "Judgments",
        "Principles",
        "Arguments",
        "Relations",
        "Theories",
      ]) {
        await page.locator(`button:text-is("${tab}")`).click();
        // Every assist panel is a lazy chunk, so the tab button responds before
        // the header exists. Without this wait the audit runs on an empty panel
        // — which the vacuity guard below then reports, but only under enough
        // parallel load to lose the race.
        await expect(page.locator('[data-accent="graph"]').first()).toBeVisible();
        await park(page);
        const failures = await graphAccentFailures(page);
        console.log(`  ${tab}/${theme}: ${failures.length || "clear"}`);
        expect(failures, `${tab}/${theme} — ${failures.join(" | ")}`).toEqual([]);
      }
      if (theme === "dark")
        await toggleMenuRow(page, "Dark mode", () =>
          page.evaluate(() => document.documentElement.dataset.theme === "light"),
        );
    }
  });

  test("every interactive control is reachable by keyboard", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    // Anything clickable that cannot be tabbed to is invisible to a keyboard
    // user, however it is styled.
    const unreachable = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href], input, select, textarea")]
        .filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0)
        .filter((el) => el.tabIndex < 0 && !el.disabled)
        .map((el) => `${el.tagName}:${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}`),
    );
    expect(unreachable, `not tabbable: ${unreachable.join(" | ")}`).toEqual([]);
  });
});
