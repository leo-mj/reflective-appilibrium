/**
 * @fileoverview Where the workspace's central divider sits — the line between
 * the panel the tab is about and whatever accompanies it.
 *
 * Half and half is a compromise that suits neither end of the work: reading a
 * long list of judgments wants the text wide, laying out an argument wants the
 * canvas wide, and the reader switches between the two several times in a
 * round. So the divider is draggable, and where it was left is remembered.
 *
 * **The ratio is measured from the left edge of the row, whichever panel is
 * fixed.** The two layouts put the flexible panel on opposite sides — analyze
 * mode reads text-then-graph, an assist tab anchors its own panel to the left
 * edge and puts the companion to the right of it — and a ratio that meant "the
 * fixed panel's share" would jump when the reader changed tabs, since that is a
 * different panel in each. Read as a position, the line stays where they put it.
 *
 * The graph's own width follows it: `graphW` in `REState` feeds the force
 * simulation, and a canvas that has been given half the row again after being
 * dragged to a third of it centres its nodes off-screen. That value is
 * coarsened (see {@link module:hooks/useCoarseDims}), so dragging re-lays-out
 * the graph only when the width really has changed by a lot — a deliberate
 * resize, not every frame of one.
 *
 * @module hooks/useSplitRatio
 */

import { useRef, useState } from "react";

import { readPref, writePref } from "../utils/storedPref.js";

const KEY = "workspaceSplit";

/** Even halves, which is where it sat before it could be moved. */
export const DEFAULT_RATIO = 0.5;
/** Past these a panel is too narrow to read and too small to aim at. */
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
/** How far one arrow key moves the line — a percentage point at a time. */
const KEY_STEP = 0.01;

const clamp = (r) => Math.max(MIN_RATIO, Math.min(MAX_RATIO, r));

const asRatio = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? clamp(value)
    : DEFAULT_RATIO;

/**
 * @returns {{
 *   rowRef: React.RefObject,
 *   ratio: number,
 *   panelWidth: string,
 *   dividerProps: Object,
 * }}
 *   `rowRef` goes on the flex row the two panels share — it is what the drag is
 *   measured against. `panelWidth` goes on whichever of them carries an explicit
 *   width; the other takes what is left with `flex: 1`. `ratio` is the line's
 *   position, for anything that has to size itself to match.
 *
 * @param {"left"|"right"} fixedSide - Which side of the row the panel carrying
 *   `panelWidth` is on.
 */
export function useSplitRatio(fixedSide) {
  const rowRef = useRef(null);
  const [ratio, setRatio] = useState(() =>
    asRatio(readPref(KEY, DEFAULT_RATIO)),
  );
  /**
   * The row's box at the moment the drag started, and the gap between the
   * pointer and the line it is moving. Both are fixed for the length of a drag:
   * holding the offset is what keeps the divider under the pointer rather than
   * jumping to it, and it absorbs the row's own furniture — the flex gap and the
   * divider's width — without this hook having to know about any of it.
   */
  const drag = useRef(null);

  const commit = (next) => {
    setRatio(next);
    writePref(KEY, next);
  };

  const dividerProps = {
    className: "split-divider",
    role: "separator",
    "aria-orientation": "vertical",
    "aria-label": "Resize panels",
    // As a percentage, which is the range the role already assumes: a splitter
    // reporting pixels would have to state a max that changes with the window.
    "aria-valuenow": Math.round(ratio * 100),
    "aria-valuemin": Math.round(MIN_RATIO * 100),
    "aria-valuemax": Math.round(MAX_RATIO * 100),
    tabIndex: 0,
    title: "Drag to resize the panels — double-click to even them up",
    style: {
      flexShrink: 0,
      alignSelf: "stretch",
      display: "flex",
      alignItems: "stretch",
      justifyContent: "center",
      // Wider than the line it draws: the line is what says where the boundary
      // is, this is what a pointer has to hit. It takes the place of the row's
      // own gap rather than adding to it — see `gap` on the workspace section —
      // so an easier target does not cost the panels any width.
      width: 12,
      touchAction: "none",
    },
    onPointerDown: (e) => {
      const row = rowRef.current?.getBoundingClientRect();
      if (e.button !== 0 || !row || !row.width) return;
      // Or the pointer selects the text in the panel either side of it.
      e.preventDefault();
      drag.current = {
        row,
        // Where the pointer is relative to the line it is about to move.
        offset: e.clientX - (row.left + ratio * row.width),
      };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      setRatio(clamp((e.clientX - d.offset - d.row.left) / d.row.width));
    },
    onPointerUp: (e) => {
      if (!drag.current) return;
      drag.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      writePref(KEY, ratio);
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onDoubleClick: () => commit(DEFAULT_RATIO),
    onKeyDown: (e) => {
      const step =
        e.key === "ArrowLeft"
          ? -KEY_STEP
          : e.key === "ArrowRight"
            ? KEY_STEP
            : 0;
      if (!step) return;
      e.preventDefault();
      commit(clamp(ratio + step));
    },
  };

  return {
    rowRef,
    ratio,
    panelWidth: `${((fixedSide === "left" ? ratio : 1 - ratio) * 100).toFixed(3)}%`,
    dividerProps,
  };
}
