import { test, expect } from "@playwright/test";
import { gotoHome } from "./helpers.js";
import { buildTourSections } from "../src/components/tour/tourSections.js";
import { TOUR_Z } from "../src/components/tour/tourZ.js";

/**
 * The whole guided tour, section by section, in a browser: every control a
 * section points at has to be on screen, uncovered, and ringed.
 *
 * The unit tests hold the script to its rules — a section ringing something in
 * the ☰ menu asks for the menu, one ringing a Settings entry on a phone asks for
 * that view — but only a browser can tell whether the ring then lands on the
 * control, and whether the control is out from behind the tour's own sheet.
 *
 * Runs under `chromium` and `mobile`: the same script at both widths, each
 * resolved for the layout reading it.
 */

/** Must match Spotlight's RING_PAD: the ring stands this far off the control. */
const RING_PAD = 5;

test.describe("The guided tour", () => {
  test("rings every control it names, on screen and uncovered", async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHome(page);
    await page.locator('button:text-is("Guided tour")').click();

    // The demo build: the sample, no model. Whether relations beyond the
    // inferential ones are shown only changes the wording of one title.
    const script = new Map(
      buildTourSections({
        isSample: true,
        hideNonEntailsRels: true,
        llmEnabled: false,
        narrow: isMobile,
      }).map((s) => [s.id, s]),
    );

    const current = page.locator('section[aria-current="step"] h3');
    const next = page.getByRole("button", { name: "Next ↓" });
    const read = [];
    let ringed = 0;

    for (;;) {
      await expect(current).toHaveCount(1);
      const id = (await current.getAttribute("id")).replace("tour-title-", "");
      read.push(id);
      const section = script.get(id);
      expect(section, `"${id}" is not in the script`).toBeTruthy();

      const targets = section.target ? [section.target].flat() : [];
      for (const target of targets) {
        await expect
          .poll(() => ringReport(page, target), {
            message: `"${id}" rings ${target}`,
            timeout: 10_000,
          })
          .toBe("ok");
        ringed += 1;
      }

      if ((await next.count()) === 0) break;
      await next.click();
      await expect(current).not.toHaveAttribute("id", `tour-title-${id}`);
    }

    // Read to the end, not stopped short by a section the loop skipped past.
    expect(read.at(-1)).toBe("done");
    expect(new Set(read).size).toBe(read.length);
    expect(ringed).toBeGreaterThan(8);
  });
});

/**
 * Whether the control is drawn, has a ring round it, and shows at its top edge
 * — "ok", or what is wrong, so a failing poll says which.
 *
 * The top edge rather than the centre: the text panel the tour rings is taller
 * than what the phone's sheet leaves of the screen, and is still shown.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} target - A `data-tutorial` id.
 */
function ringReport(page, target) {
  return page.evaluate(
    ({ target, pad, ringZ }) => {
      const el = [...document.querySelectorAll(`[data-tutorial="${target}"]`)]
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .find(({ r }) => r.width > 0 && r.height > 0);
      if (!el) return "not drawn";
      const { e, r } = el;

      const spotlight = [...document.querySelectorAll("svg")].find(
        (s) => s.style.zIndex === String(ringZ),
      );
      const rings = spotlight
        ? [...spotlight.querySelectorAll(":scope > rect[stroke]")]
        : [];
      const near = (a, b) => Math.abs(a - b) <= 2;
      const hasRing = rings.some((ring) => {
        const x = +ring.getAttribute("x");
        const y = +ring.getAttribute("y");
        return (
          near(x, r.left - pad) &&
          near(y, r.top - pad) &&
          near(+ring.getAttribute("width"), r.width + pad * 2) &&
          near(+ring.getAttribute("height"), r.height + pad * 2)
        );
      });
      if (!hasRing) return `no ring round it (${rings.length} rings drawn)`;

      if (r.top < 0 || r.top >= innerHeight) return "off screen";
      const x = r.left + r.width / 2;
      const y = r.top + Math.min(r.height / 2, 12);
      const hit = document.elementFromPoint(x, y);
      if (!hit || !e.contains(hit)) {
        return `covered by <${hit?.tagName.toLowerCase()}> ${(hit?.getAttribute("aria-label") ?? hit?.textContent ?? "").slice(0, 40)}`;
      }
      return "ok";
    },
    { target, pad: RING_PAD, ringZ: TOUR_Z.ring },
  );
}
