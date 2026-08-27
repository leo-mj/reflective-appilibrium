/**
 * @fileoverview An add bar, sized by the reader rather than by the stylesheet.
 *
 * The bar holds three different forms and the one text field they share, and no
 * single size suits all of them: someone writing out a judgment wants the field
 * tall, someone chaining premises wants the row wide and the field out of the
 * way. So both axes are draggable, and the size is remembered — a bar that
 * sprang back to its default on every reload would not be worth dragging.
 *
 * **Every add bar is one bar, at one height.** The strip under the text panel
 * and the panel at the foot of an assist tab are the same control in two
 * places — an add button, its fields, and a statement box — and a reader who
 * has dragged one taller has said how tall they want that control, not how tall
 * they want it *here*. So the height goes in one stored key and every bar reads
 * it. Only one of them is ever mounted at a time (`REState` hides the strip on
 * an assist tab), which is why reading the store at mount is enough to keep
 * them in step; two of them on screen at once would want a shared store.
 *
 * **A dragged height is a floor, not a size.** The bar is sized by its contents
 * between two bounds — that floor, and {@link HEIGHT_CAP} above it — because the
 * contents grow while the reader works: an argument taking on premises wraps the
 * controls row two and three deep. Below the floor the bar cannot fall, past its
 * contents the top edge moves up, and at the cap it scrolls rather than reaching
 * under the window. See `sizeStyle`.
 *
 * The width is the exception, and `axes` is how a bar says so: the strip spans
 * the window and can give width back, while an assist panel is as wide as the
 * column the divider has left it. A height-only bar keeps its hands off the
 * stored width rather than resetting it — see `onDoubleClick`.
 *
 * The phone sheet is not resizable and does not call this: there the bar is
 * already most of the screen, and the two axes it could give are the two the
 * screen has none of.
 *
 * @module hooks/useAddBarSize
 */

import { useRef, useState } from "react";

import { C } from "../constants/colors.js";
import { readPref, writePref } from "../utils/storedPref.js";

const KEY = "addBarSize";

/** Under this the controls row has crowded the text field out of existence. */
const MIN_HEIGHT = 110;
/** Narrower and an argument's pickers cannot make a row between them. */
const MIN_WIDTH = 360;
/** The graph above it has the better claim on the rest of the window. */
const MAX_HEIGHT_FRACTION = 0.75;
/** How far one arrow key moves an edge. */
const KEY_STEP = 16;

/**
 * How tall a bar may ever be: whichever is the smaller of a share of the window
 * and the whole of the panel it sits in.
 *
 * Two different failures, one cap. `dvh` is the window's — the graph above the
 * bar has the better claim on the screen, and it is the same fraction the drag
 * itself clamps to. `100%` is the panel's: an assist tab's bar is as tall as
 * that tab, and one that outgrows it reaches past the bottom of the window and
 * gives the whole page a scrollbar. In CSS rather than measured here, so both
 * answer a window being resized rather than only a re-render.
 */
export const HEIGHT_CAP = `min(${Math.round(MAX_HEIGHT_FRACTION * 100)}dvh, 100%)`;

/** The default: `null` on both axes, meaning "whatever the stylesheet says". */
const UNSET = { height: null, width: null };

/** Either axis may be missing, and a stored value from another version may be anything. */
function readStored() {
  const raw = readPref(KEY, null);
  if (!raw || typeof raw !== "object") return UNSET;
  return {
    height: Number.isFinite(raw.height) ? raw.height : null,
    width: Number.isFinite(raw.width) ? raw.width : null,
  };
}

const store = (size) => writePref(KEY, size);

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
  height: {
    ...HANDLE_BASE,
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    cursor: "ns-resize",
  },
  width: {
    ...HANDLE_BASE,
    top: 0,
    right: 0,
    bottom: 0,
    width: 6,
    cursor: "ew-resize",
  },
  // Over the other two where they meet, so the corner gives both axes at once.
  both: {
    ...HANDLE_BASE,
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    zIndex: 3,
    cursor: "nesw-resize",
  },
};

const HANDLE_LABEL = {
  height: "Resize add bar height",
  width: "Resize add bar width",
  both: "Resize add bar",
};

/**
 * @param {boolean} enabled - False for the phone sheet, which keeps its own
 *   sizing; the hook then hands back styles that change nothing and no handles.
 * @param {Object} [options]
 * @param {"both"|"height"} [options.axes] - Which axes this bar owns. `"height"`
 *   is for a bar whose width is not its own to give — an assist tab's panel,
 *   which is as wide as the column it sits in.
 * @returns {{ ref: React.RefObject, sizeStyle: Object, handleProps: (axis: "height"|"width"|"both") => Object|null }}
 */
export function useAddBarSize(enabled, { axes: owns = "both" } = {}) {
  const ownsWidth = owns === "both";
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
    if (!enabled || (!ownsWidth && axis !== "height")) return null;
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
              value ??
                ref.current?.getBoundingClientRect()[
                  axes.y ? "height" : "width"
                ] ??
                0,
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
      // second handle to finish undoing it is the annoying half. Both of the
      // ones this bar owns, that is — a panel with no width of its own to give
      // must not throw away the width the strip was left at.
      onDoubleClick: () => {
        const next = ownsWidth ? UNSET : { ...latest.current, height: null };
        latest.current = next;
        setSize(next);
        store(next);
      },
      onKeyDown: (e) => {
        const step = {
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
        }[e.key];
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
      ...(enabled
        ? {
            // The bar is sized by its contents between two bounds, which is the
            // whole of how it behaves. A dragged height is the floor, not the
            // size: the controls grow — an argument taking on premises wraps
            // the row two and three deep — and a bar pinned to a height its own
            // contents have outgrown clips them, which is how the text field
            // came to be squeezed out of the bottom of it. Past the content the
            // bar is anchored at the foot of its panel, so it is the top edge
            // that moves.
            //
            // Which leaves the floor as the whole of what the bar measures with
            // nothing in it — `ADD_BAR_MIN_HEIGHT`, or what this reader dragged
            // it to last. A bar that opens taller than that is one carrying a
            // dragged height; double-clicking the top edge gives it back.
            //
            // Its own contents are what the bar is sized by, and the plainest
            // way to say so is to say nothing: an auto height on a column is
            // the height of what is in it. `height: max-content` says the same
            // thing in a way not every engine reads alike — one of them drew
            // the bar at twice its contents from a standing start — and this
            // has no such second reading.
            maxHeight: HEIGHT_CAP,
            // At the cap the content has nowhere left to grow, so it scrolls
            // here rather than out of the panel. Sideways it may not: nothing
            // in this app is read by scrolling that way, and a scroll container
            // on one axis makes one of the other unless it is told otherwise —
            // in `hidden`, which every engine has, rather than the `clip` that
            // says it better and is dropped by the ones that do not know it.
            overflowY: "auto",
            overflowX: "hidden",
            // The floor takes the same two caps, because in CSS a minimum wins
            // over a maximum: a height dragged out on a tall window and read
            // back on a short one would otherwise hold the bar past the bottom
            // of the screen — the cap above it and all — and take the page's
            // own scrollbar with it. Absent, the floor is the stylesheet's; see
            // ADD_BAR_MIN_HEIGHT.
            ...(size.height
              ? { minHeight: `min(${size.height}px, ${HEIGHT_CAP})` }
              : null),
          }
        : null),
      ...(ownsWidth && size.width
        ? // Anchored at the left edge, which is where the panel it belongs to
          // starts. maxWidth guards a width remembered from a wider window.
          { width: size.width, maxWidth: "100%", alignSelf: "flex-start" }
        : null),
    },
    handleProps,
  };
}
