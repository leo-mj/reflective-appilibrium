// @vitest-environment jsdom
//
// A standing accessibility gate over the two views a visitor actually lands on.
// Individual components are checked in their own suites; this catches the class
// of defect rather than the instance, so an icon-only button added next month
// fails here without anyone remembering to write an assertion for it.
//
// Scope note: jsdom has no layout or rendering, so contrast and target-size
// rules cannot be evaluated here and are excluded. Those need a real browser.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import axe from "axe-core";

import { HomePage } from "./components/HomePage.jsx";
import REState from "./components/REState.jsx";
import { SAMPLE_STATE } from "./state.js";

afterEach(cleanup);

/** Rules that need real layout, which jsdom cannot provide. */
const NEEDS_A_BROWSER = ["color-contrast", "target-size"];

/**
 * Runs axe over `container` and returns its violations, most serious first.
 * Restricted to the WCAG A/AA rules — axe's "best-practice" tags carry
 * opinions we have not signed up to.
 */
async function violationsIn(container) {
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: Object.fromEntries(
      NEEDS_A_BROWSER.map((id) => [id, { enabled: false }]),
    ),
  });
  return results.violations;
}

/** Turns axe output into something that names the offending element. */
const describeViolations = (violations) =>
  violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n` +
        v.nodes.map((n) => `    ${n.html}`).join("\n"),
    )
    .join("\n");

const expectNoViolations = async (container) => {
  const violations = await violationsIn(container);
  expect(describeViolations(violations)).toBe("");
};

/**
 * Buttons whose accessible name says nothing.
 *
 * axe cannot catch these: its button-name rule is satisfied by any text
 * content, and a glyph is text. "☰" and "▶" pass the rule while announcing as
 * "trigram for heaven" and "black right-pointing triangle". We require a name
 * with a real word in it — three consecutive letters — which an icon plus an
 * `aria-label` satisfies and a bare glyph does not.
 */
const unnamedButtons = (container) =>
  [...container.querySelectorAll("button")]
    .map((b) => ({
      html: b.outerHTML.slice(0, 120),
      name: (
        b.getAttribute("aria-label") ??
        b.getAttribute("title") ??
        b.textContent
      ).trim(),
    }))
    .filter(({ name }) => !/[A-Za-z]{3,}/.test(name))
    .map(({ html, name }) => `  name "${name}" — ${html}`)
    .join("\n");

/**
 * Checks the view has one h1 and never skips a level on the way down. Screen
 * reader users navigate by heading, so a view with none is a flat wall of text
 * with no way to jump into it.
 */
const expectSaneHeadings = (container) => {
  const levels = [...container.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) =>
    Number(h.tagName[1]),
  );
  expect(
    levels.filter((l) => l === 1),
    "expected exactly one h1",
  ).toHaveLength(1);
  expect(levels[0], "the first heading should be the h1").toBe(1);
  levels.reduce((deepest, level) => {
    expect(
      level,
      `heading jumped from h${deepest} to h${level}`,
    ).toBeLessThanOrEqual(deepest + 1);
    return Math.max(deepest, level);
  }, 1);
};

describe("the landing page", () => {
  it("has no WCAG A/AA violations axe can see", async () => {
    const { container } = render(
      <HomePage
        onStartFresh={() => {}}
        onLoadSample={() => {}}
        onLoadQuestionnaire={() => {}}
        onLoadSession={() => {}}
      />,
    );
    await expectNoViolations(container);
    expect(unnamedButtons(container)).toBe("");
    expectSaneHeadings(container);
  });
});

describe("the main app view", () => {
  /** jsdom has no layout, and this audit needs none of the work that wants it. */
  const stubBrowserWork = () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const NoopObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    vi.stubGlobal("ResizeObserver", NoopObserver);
    vi.stubGlobal("IntersectionObserver", NoopObserver);
  };

  const app = () =>
    render(
      <REState
        initialState={SAMPLE_STATE}
        isSample
        onHome={() => {}}
        onReady={() => {}}
      />,
    );

  it("has no WCAG A/AA violations axe can see", async () => {
    stubBrowserWork();
    const { container } = app();
    await expectNoViolations(container);
    expect(unnamedButtons(container)).toBe("");
    expectSaneHeadings(container);
    vi.unstubAllGlobals();
  });

  it("still has none with the guided tour open over it", async () => {
    // The tour is a page of prose with its own heading tree, laid over a view
    // that already has one — the reading order has to survive that.
    stubBrowserWork();
    sessionStorage.setItem("startTour", "1");
    const { container } = app();
    await expectNoViolations(container);
    expect(unnamedButtons(container)).toBe("");
    expectSaneHeadings(container);
    sessionStorage.removeItem("startTour");
    vi.unstubAllGlobals();
  });

  it("still has none with the tour open as a sheet on a narrow screen", async () => {
    // Same prose, laid along the bottom edge — plus one control the column has
    // no use for, the handle that swaps the sheet between its two heights. A
    // grabber bar is a drag affordance with nothing to announce unless it is
    // given a name, so this is the audit that holds it to one.
    stubBrowserWork();
    window.innerWidth = 420;
    window.innerHeight = 800;
    sessionStorage.setItem("startTour", "1");
    const { container } = app();
    await expectNoViolations(container);
    expect(unnamedButtons(container)).toBe("");
    expectSaneHeadings(container);
    sessionStorage.removeItem("startTour");
    window.innerWidth = 1024;
    window.innerHeight = 768;
    vi.unstubAllGlobals();
  });
});
