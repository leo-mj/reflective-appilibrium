/**
 * @fileoverview The guided tour's furniture: its progress bar, the narrow
 * sheet's grabber and the wide column's resizable edge.
 *
 * @module components/tour/TourControls
 */

import { useRef } from "react";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import {
  TOUR_MAX_W,
  TOUR_MIN_W,
  resetTourWidth,
  setTourResizing,
  setTourWidth,
  storeTourWidth,
} from "./tourWidth.js";

/** How far one arrow key moves the column's edge. */
const KEY_STEP = 16;

/** Past this, a press on the sheet's handle is a swipe rather than a tap. */
const SWIPE_MIN = 8;

export function ProgressBar({ value }) {
  return (
    <div
      style={{
        height: 3,
        background: C.border,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value * 100}%`,
          height: "100%",
          background: C.supports,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

/**
 * The grabber along the top of the narrow sheet: tap to swap between the two
 * heights, or swipe it the way you want it to go.
 *
 * A button rather than a bare drag surface, so it has a name, a tab stop and an
 * expanded state. Two heights rather than a free drag because the sheet is
 * sharing the screen with a graph that reflows to whatever is left: a
 * continuous drag would have the graph re-fitting under the reader's thumb all
 * the way down.
 */
export function SheetHandle({ expanded, onToggle }) {
  const pressedAt = useRef(null);
  return (
    <button
      onPointerDown={(e) => {
        pressedAt.current = e.clientY;
      }}
      onPointerUp={(e) => {
        const dy = e.clientY - (pressedAt.current ?? e.clientY);
        onToggle(Math.abs(dy) < SWIPE_MIN ? !expanded : dy < 0);
      }}
      // Keyboards and assistive tech never send the pointer events above.
      onClick={(e) => {
        if (e.detail === 0) onToggle(!expanded);
      }}
      aria-expanded={expanded}
      aria-label={expanded ? "Shrink the tour" : "Expand the tour"}
      style={{
        background: "transparent",
        border: "none",
        padding: "8px 0 4px",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        cursor: "pointer",
        touchAction: "none",
      }}
    >
      <span
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: C.border,
          display: "block",
        }}
      />
    </button>
  );
}

/**
 * The column's right edge, dragged to give the tour more of the screen or less.
 *
 * Unlike the sheet's handle this is a free drag, and for the mirror of the same
 * reason: the graph beside a column reflows to a *width*, and a reader who wants
 * the prose wider is doing exactly that on purpose. The two heights the sheet
 * offers are what keeps a graph from re-fitting under a thumb that was only
 * scrolling.
 *
 * Not painted at rest — the column's own border already says where it ends — so
 * the resize cursor and the title are what announce it, as on the add bar's
 * edges. `.resize-handle` in index.css is the hover and focus state.
 *
 * The width is not held here: the app outside pads itself by the same number,
 * and the two have to agree. See {@link module:components/tour/tourWidth}.
 */
export function ColumnResizer({ width }) {
  /** Where the pointer went down, and how wide the column was then. */
  const drag = useRef(null);

  const nudge = (dx) => {
    setTourWidth(width + dx);
    storeTourWidth();
  };

  return (
    // The one trigger whose own handlers matter: Tooltip adds pointer handlers
    // of its own and calls the child's first, so the drag is unaffected. On a
    // touchscreen a press held here will still open the tooltip mid-drag, which
    // is the price of the app having one tooltip rather than two — and this
    // handle is wide-layout only, where the pointer is a mouse.
    <Tooltip text="Drag to resize the tour — double-click to reset, or arrow keys">
      <div
        className="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize tour column"
        aria-valuenow={width}
        aria-valuemin={TOUR_MIN_W}
        aria-valuemax={TOUR_MAX_W}
        tabIndex={0}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 7,
          background: C.dim,
          cursor: "ew-resize",
          touchAction: "none",
          zIndex: 1,
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // Or the pointer picks up the prose beside it instead.
          e.preventDefault();
          drag.current = { x: e.clientX, width };
          setTourResizing(true);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setTourWidth(drag.current.width + (e.clientX - drag.current.x));
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          drag.current = null;
          setTourResizing(false);
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          storeTourWidth();
        }}
        onPointerCancel={() => {
          drag.current = null;
          setTourResizing(false);
        }}
        onDoubleClick={resetTourWidth}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") nudge(-KEY_STEP);
          else if (e.key === "ArrowRight") nudge(KEY_STEP);
          else return;
          e.preventDefault();
        }}
      />
    </Tooltip>
  );
}
