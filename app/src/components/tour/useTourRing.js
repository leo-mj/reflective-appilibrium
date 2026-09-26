/**
 * @fileoverview Where the tour's spotlight rings, and whether it still should:
 * the controls the section is about, measured on screen, until the reader
 * starts using the app.
 *
 * @module components/tour/useTourRing
 */

import { useCallback, useEffect, useState } from "react";
import { sheetHeight } from "./tourZ.js";
import { revealAbove } from "./tourHelpers.js";

/** Shared empty array, so "nothing ringed" is a stable value between renders. */
const EMPTY = [];

/**
 * @param {Object}  args
 * @param {boolean} args.active
 * @param {number}  args.idx      - The section being read.
 * @param {string|string[]|undefined} args.target - Its `data-tutorial` names.
 * @param {boolean} args.sheet    - The narrow layout, whose sheet can cover a
 *   target.
 * @param {boolean} args.expanded - The sheet's height.
 * @param {number}  args.width    - The column's; see `measureRing`.
 * @param {{ current: Element|null }} args.panelRef - The tour itself, where a
 *   press is reading rather than using the app.
 * @returns {DOMRect[]} What to ring — none once the reader has used the app.
 */
export function useTourRing({
  active,
  idx,
  target,
  sheet,
  expanded,
  width,
  panelRef,
}) {
  const [rects, setRects] = useState(EMPTY);

  // The spotlight points at a control and dims everything else, which is right
  // while the reader is being shown where it is and wrong the moment they use
  // it: pressing Start Workflow would leave what it started behind a grey
  // sheet, and a ring drawn over the graph goes on covering whatever the reader
  // opens on top of it. So the first touch of the app anywhere takes the whole
  // highlight away; the next section arms it again.
  const [ringArmedFor, setRingArmedFor] = useState(0);
  const [ringShown, setRingShown] = useState(true);
  if (ringArmedFor !== idx) {
    setRingArmedFor(idx);
    setRingShown(true);
  }

  // A section may name more than one: two routes to the same thing are worth
  // showing together, and the spotlight cuts a hole for each.
  const targets = target ? [target].flat() : EMPTY;
  const targetKey = targets.join(" ");
  const measureRing = useCallback(() => {
    const found = targets
      .map((t) => document.querySelector(`[data-tutorial="${t}"]`))
      .filter(Boolean);
    // Bring them out from under the sheet before reading where they are, or
    // the ring is drawn correctly around something nobody can see.
    if (sheet) {
      const top =
        window.innerHeight - sheetHeight(window.innerHeight, expanded);
      found.forEach((el) => revealAbove(el, top));
    }
    setRects(found.map((el) => el.getBoundingClientRect()));
    // `width` is not read here but every rect depends on it: the app is padded
    // by the column, so dragging its edge moves everything the ring is drawn
    // around. Listed so the effect below re-measures as it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, sheet, expanded, width]);

  useEffect(() => {
    if (!active) return;
    // Two frames: the first lets the tab switch and the chrome above render,
    // the second measures where the target actually landed. The later pass is
    // for targets that are not in the DOM yet at that point — an entry in a
    // menu this section is also asking the header to open.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(measureRing);
    });
    const settled = setTimeout(measureRing, 180);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(settled);
    };
  }, [active, idx, measureRing]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", measureRing);
    return () => window.removeEventListener("resize", measureRing);
  }, [active, measureRing]);

  // Using the app takes the highlight away. Capture phase, so it lands whether
  // or not the control stops the event, and pointerdown rather than click so
  // the sheet is gone before whatever was pressed redraws underneath it.
  useEffect(() => {
    if (!active) return;
    const used = () => setRingShown(false);
    const onPointerDown = (e) => {
      if (!panelRef.current?.contains(e.target)) used();
    };
    // The keyboard equivalent: driving the app from the keyboard is using it
    // just as much, and Enter on a focused button never fires a pointer event.
    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Tab") return;
      if (!panelRef.current?.contains(document.activeElement)) used();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active, panelRef]);

  return ringShown ? rects : EMPTY;
}
