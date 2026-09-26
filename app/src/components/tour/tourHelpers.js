/**
 * @fileoverview What the guided tour works out before it draws anything: which
 * sections of the script this state can carry, and how to bring a control out
 * from behind the narrow sheet.
 *
 * @module components/tour/tourHelpers
 */

/** Gap left above the sheet when it scrolls a ringed control clear of it. */
const REVEAL_PAD = 12;

/**
 * Drops any section whose elements or argument the state does not hold.
 *
 * The demo-graph chapter names elements by ID. Editing the sample fixture, or
 * running the tour over an imported process, should cost the tour that section
 * rather than leave it pointing at nothing.
 */
export function applicableSections(sections, state) {
  const ids = new Set(state.elements.map((e) => e.id));
  const args = new Set(
    state.relations.map((r) => r.argumentId).filter(Boolean),
  );
  return sections.filter((s) => {
    const named = [...(s.quote ?? []), ...(s.focus ?? []), s.select].filter(
      Boolean,
    );
    if (named.some((id) => !ids.has(id))) return false;
    return !s.argument || args.has(s.argument);
  });
}

/** The nearest ancestor that has somewhere to scroll to. */
function scrollParent(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    )
      return node;
  }
  return null;
}

/**
 * Scrolls a control out from behind the narrow sheet.
 *
 * Most of what that layout rings are entries in the ☰ menu, which is longer
 * than the strip of screen left above the sheet. `scrollIntoView` will not do
 * it: it reckons in viewport, and by the viewport's arithmetic an entry behind
 * the sheet is already perfectly visible.
 *
 * @param {Element} el
 * @param {number}  limitY - Screen y the sheet's top edge sits at.
 */
export function revealAbove(el, limitY) {
  const box = scrollParent(el);
  if (!box) return;
  const overshoot = el.getBoundingClientRect().bottom - limitY;
  if (overshoot > 0) box.scrollTop += overshoot + REVEAL_PAD;
}
