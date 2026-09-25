/**
 * @fileoverview A canvas gliding from one arrangement to another: every
 * element from where it stood to where it is going, and the view — pan and
 * zoom — to a framing of the new arrangement with it.
 *
 * What the statement view does when switched: the reader follows each node to
 * its card and back rather than finding them all again. The shapes change at
 * once; it is the places that move.
 *
 * @module hooks/useViewGlide
 */

/** @import { PositionMap, Dims } from '../types.js' */

import { useEffect, useRef, useState } from "react";

import { fitView } from "../utils/graphHelpers.js";

/** How long a glide takes, in ms. */
const MOTION_MS = 320;

/** Ease in and out, so the glide neither starts nor lands with a jolt. */
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const lerp = (a, b, t) => a + (b - a) * t;

/** Whether the reader has asked their system for less motion. */
const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Positions part of the way from `from` to `to`. Anything `from` did not hold
 * — an element added mid-glide — is simply at its destination.
 *
 * @param {PositionMap} from
 * @param {PositionMap} to
 * @param {number} t - 0 is `from`, 1 is `to`.
 * @returns {PositionMap}
 */
function between(from, to, t) {
  const out = {};
  for (const [id, p] of Object.entries(to)) {
    const q = from[id];
    out[id] = q ? { ...p, x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t) } : p;
  }
  return out;
}

/**
 * Re-frames the canvas whenever `trigger` changes, gliding there from the
 * departure last marked.
 *
 * Mark the departure — `depart()` — at the moment of the change, in the
 * handler that makes it: by the effect that runs after, the new positions are
 * already the answer and there is nothing left to glide from. A change with no
 * departure marked, or a reader whose system asks for less motion, jumps.
 *
 * @param {Object} args
 * @param {*} args.trigger - What changing re-frames the canvas.
 * @param {PositionMap} args.positions - Where things are going.
 * @param {Dims} args.dims - The canvas, to frame against.
 * @param {function} args.resetView - From `usePan`.
 * @param {{ x: number, y: number }} args.pan - From `usePan`.
 * @param {number} args.zoom - From `usePan`.
 * @returns {{ drawn: PositionMap, depart: function(): void }} `drawn` is where
 *   to draw things now: `positions`, or part of the way there.
 */
export function useViewGlide({ trigger, positions, dims, resetView, pan, zoom }) {
  // What the canvas last drew, and where the view stood: a glide starts here.
  const shown = useRef(null);
  const departure = useRef(null);
  const depart = () => {
    departure.current = { positions: shown.current, pan, zoom };
  };

  const [glide, setGlide] = useState(null);
  const framed = useRef(trigger);
  useEffect(() => {
    if (framed.current === trigger) return;
    framed.current = trigger;
    const view = fitView(positions, null, dims, { padding: 96, maxZoom: 1 });
    const from = departure.current;
    departure.current = null;
    if (!view) return;
    if (!from?.positions || reducedMotion()) {
      setGlide(null);
      resetView(view.pan, view.zoom);
      return;
    }
    let frame;
    const start = performance.now();
    const step = (now) => {
      // Clamped below too: a frame's timestamp is when the frame began, which
      // can fall just before `start`, and eased backwards is a twitch.
      const t = Math.min(1, Math.max(0, (now - start) / MOTION_MS));
      const e = ease(t);
      resetView(
        { x: lerp(from.pan.x, view.pan.x, e), y: lerp(from.pan.y, view.pan.y, e) },
        lerp(from.zoom, view.zoom, e),
      );
      setGlide(t < 1 ? { from: from.positions, t: e } : null);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setGlide({ from: from.positions, t: 0 });
    frame = requestAnimationFrame(step);
    // Changed again mid-glide: the next one starts from wherever this got to.
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const drawn = glide ? between(glide.from, positions, glide.t) : positions;
  useEffect(() => {
    shown.current = drawn;
  });

  return { drawn, depart };
}
