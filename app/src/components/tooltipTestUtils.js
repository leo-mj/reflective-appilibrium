/**
 * @fileoverview Reading an app tooltip from a test.
 *
 * The app has one tooltip — {@link module:components/Tooltip} — and it is not a
 * DOM `title`: it opens after a hover delay and renders into a portal on
 * `document.body`. So a test that used to read `node.title` has to hover and
 * wait, and every such test wants the same six lines. They are here once.
 *
 * Not a `.test.js` file, so Vitest does not collect it as a suite; it imports
 * `vitest` all the same, which is why nothing outside a test may import it.
 *
 * @module components/tooltipTestUtils
 */

import { vi } from "vitest";
import { act, fireEvent } from "@testing-library/react";

/** The hover delay `Tooltip` opens after, by default. */
const DELAY = 400;

/**
 * Hovers `node` and returns the tooltip text that appears, or `""`.
 *
 * Leaves no tooltip behind and hands the clock back, so it can be called more
 * than once in a test and mixed with assertions that need real timers.
 *
 * @param {Element} node - The trigger, or anything inside it.
 * @returns {string}
 */
export function tooltipText(node) {
  vi.useFakeTimers();
  try {
    fireEvent.mouseEnter(node);
    act(() => {
      vi.advanceTimersByTime(DELAY);
    });
    // The portalled box, told apart from the app's own fixed elements by being
    // the one that cannot be pointed at.
    const box = [...document.body.querySelectorAll("div")].findLast(
      (d) => d.style.position === "fixed" && d.style.pointerEvents === "none",
    );
    const text = box?.textContent ?? "";
    act(() => {
      fireEvent.mouseLeave(node);
    });
    return text;
  } finally {
    vi.useRealTimers();
  }
}
