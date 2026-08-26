/**
 * @fileoverview The wide layout's add bar, sized by the reader rather than by
 * the stylesheet.
 *
 * The bar holds three different forms and the one text field they share, and no
 * single size suits all of them: someone writing out a judgment wants the field
 * tall, someone chaining premises wants the row wide and the field out of the
 * way. So both axes are draggable, and the size is remembered — a bar that
 * sprang back to its default on every reload would not be worth dragging.
 *
 * The phone sheet is not resizable and does not call this: there the bar is
 * already most of the screen, and the two axes it could give are the two the
 * screen has none of.
 *
 * @module hooks/useAddBarSize
 */

import { useRef, useState } from "react";

import { C } from "../constants/colors.js";

const KEY = "addBarSize";

/** Under this the controls row has crowded the text field out of existence. */
const MIN_HEIGHT = 110;
/** Narrower and an argument's pickers cannot make a row between them. */
const MIN_WIDTH = 360;
/** The graph above it has the better claim on the rest of the window. */
const MAX_HEIGHT_FRACTION = 0.75;
/** How far one arrow key moves an edge. */
const KEY_STEP = 16;

/** The default: `null` on both axes, meaning "whatever the stylesheet says". */
const UNSET = { height: null, width: null };

/** localStorage throws in private-mode Safari; a remembered size is not worth a crash. */
function readStored() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return UNSET;
    return {
      height: Number.isFinite(raw.height) ? raw.height : null,
      width: Number.isFinite(raw.width) ? raw.width : null,
    };
  } catch {
    return UNSET;
  }
}

function store(size) {
  try {
    localStorage.setItem(KEY, JSON.stringify(size));
  } catch {
    /* a preference is not worth failing over */
  }
}

const clampHeight = (h) =>
  Math.max(
    MIN_HEIGHT,
    Math.min(h, Math.round(window.innerHeight * MAX_HEIGHT_FRACTION)),
  );

const clampWidth = (w, el) => {
  // The bar's own row, which is the app's content box: dragging past it would
  // put the far edge under the window's chrome with no way to fetch it back.
  const max = el?.parentElement?.clientWidth ?? window.innerWidth;
  return Math.max(Math.min(MIN_WIDTH, max), Math.min(w, max));
};

/** Which edges a handle moves. */
const AXES = {
  height: { y: true, x: false },
  width: { y: false, x: true },
  both: { y: true, x: true },
};

const HANDLE_BASE = {
  position: "absolute",
  // Painted only under the pointer or the focus ring — see `.resize-handle` in
  // index.css. A permanent grip on two edges of a bar this wide is a lot of
  // furniture for something used once and then left alone.
  background: C.dim,
  touchAction: "none",
  zIndex: 2,
};

const HANDLE_STYLE = {
  height: { ...HANDLE_BASE, top: 0, left: 0, right: 0, height: 6, cursor: "ns-resize" },
  width: { ...HANDLE_BASE, top: 0, right: 0, bottom: 0, width: 6, cursor: "ew-resize" },
  // Over the other two where they meet, so the corner gives both axes at once.
  both: { ...HANDLE_BASE, top: 0, right: 0, width: 14, height: 14, zIndex: 3, cursor: "nesw-resize" },
};

const HANDLE_LABEL = {
  height: "Resize add bar height",
  width: "Resize add bar width",
  both: "Resize add bar",
};

/**
 * @param {boolean} enabled - False for the phone sheet, which keeps its own
 *   sizing; the hook then hands back styles that change nothing and no handles.
 * @returns {{ ref: React.RefObject, sizeStyle: Object, handleProps: (axis: "height"|"width"|"both") => Object|null }}
 */
export function useAddBarSize(enabled) {
  const ref = useRef(null);
  const [size, setSize] = useState(enabled ? readStored : UNSET);
  /** Mirrors `size`, so a drag can persist what it ended on without an effect. */
  const latest = useRef(size);
  /** Where the pointer went down, and how big the bar was then. Null when idle. */
  const drag = useRef(null);

  const commit = (next) => {
    latest.current = { ...latest.current, ...next };
    setSize(latest.current);
  };

  const resize = (axes, dx, dy) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const from = drag.current ?? { width: rect.width, height: rect.height };
    const next = {};
    // Up and to the right grow it: the bar is anchored at the foot of the
    // window and at its left edge, so those are the two edges that can move.
    if (axes.y) next.height = clampHeight(from.height - dy);
    if (axes.x) next.width = clampWidth(from.width + dx, el);
    commit(next);
  };

  const handleProps = (axis) => {
    if (!enabled) return null;
    const axes = AXES[axis];
    const value = axes.x && !axes.y ? size.width : size.height;
    return {
      className: "resize-handle",
      style: HANDLE_STYLE[axis],
      // A splitter, which is what a focusable separator is for. The corner is
      // the exception: it moves two axes, which the role cannot describe, and
      // both of them are reachable from the edges either side of it.
      ...(axis === "both"
        ? { "aria-hidden": true }
        : {
            role: "separator",
            tabIndex: 0,
            // Horizontal for the top edge: the separator lies that way, and it
            // is the height on the other side of it that moves.
            "aria-orientation": axes.y ? "horizontal" : "vertical",
            "aria-label": HANDLE_LABEL[axis],
            "aria-valuenow": Math.round(
              value ?? ref.current?.getBoundingClientRect()[axes.y ? "height" : "width"] ?? 0,
            ),
            "aria-valuemin": axes.y ? MIN_HEIGHT : MIN_WIDTH,
            // Stated rather than left to the role's default of 100, which every
            // size here is past — a splitter reporting 240 out of 100 reads as
            // a broken control to anything announcing it as a percentage.
            "aria-valuemax": axes.y
              ? Math.round(window.innerHeight * MAX_HEIGHT_FRACTION)
              : (ref.current?.parentElement?.clientWidth ?? window.innerWidth),
          }),
      title: `Drag to resize — double-click to reset${axis === "both" ? "" : ", or arrow keys"}`,
      onPointerDown: (e) => {
        if (e.button !== 0) return;
        // Or the pointer picks up the text either side of the handle instead.
        e.preventDefault();
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        drag.current = {
          axes,
          x: e.clientX,
          y: e.clientY,
          width: rect.width,
          height: rect.height,
        };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        const d = drag.current;
        if (!d) return;
        resize(d.axes, e.clientX - d.x, e.clientY - d.y);
      },
      onPointerUp: (e) => {
        if (!drag.current) return;
        drag.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        store(latest.current);
      },
      onPointerCancel: () => {
        drag.current = null;
      },
      // Both axes at once, whichever handle it lands on: a bar left at some
      // size that no longer suits is one thing, not two, and hunting for the
      // second handle to finish undoing it is the annoying half.
      onDoubleClick: () => {
        latest.current = UNSET;
        setSize(UNSET);
        store(UNSET);
      },
      onKeyDown: (e) => {
        const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
        if (!step) return;
        const [sx, sy] = step;
        // Each edge answers only for the axis it moves, so an arrow the other
        // way scrolls the page as it otherwise would.
        if ((sy && !axes.y) || (sx && !axes.x)) return;
        e.preventDefault();
        resize(axes, sx * KEY_STEP, sy * KEY_STEP);
        store(latest.current);
      },
    };
  };

  return {
    ref,
    sizeStyle: {
      position: "relative",
      ...(size.height ? { height: size.height, minHeight: 0 } : null),
      ...(size.width
        ? // Anchored at the left edge, which is where the panel it belongs to
          // starts. maxWidth guards a width remembered from a wider window.
          { width: size.width, maxWidth: "100%", alignSelf: "flex-start" }
        : null),
    },
    handleProps,
  };
}
