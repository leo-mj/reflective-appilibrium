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

import { useCallback, useEffect, useRef, useState } from "react";

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

/**
 * The view gliding to a new pan, at the zoom it has: the same motion as
 * {@link useViewGlide}, with nothing on the canvas moving but the view.
 *
 * @param {{ resetView: function, pan: { x: number, y: number }, zoom: number }} args
 *   From `usePan`.
 * @returns {{ glideTo: function({ x: number, y: number }): void, stop: function(): void }}
 *   `stop` leaves the view wherever the glide has got to — for a pointer or
 *   a wheel taking the view over mid-glide, which the next frame would
 *   otherwise wrest back.
 */
export function usePanGlide({ resetView, pan, zoom }) {
  const frame = useRef(null);
  // Stable, so a handler built on it — the canvas's wheel listener — is not
  // re-attached on every render.
  const stop = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  /**
   * @param {{ x: number, y: number }} to
   * @param {function(number, number): void} [onMove] - Told how far the view
   *   moved on each frame, for anything placed in page coordinates that has to
   *   move with it.
   */
  const glideTo = (to, onMove) => {
    stop();
    let at = pan;
    const moveTo = (next) => {
      resetView(next, zoom);
      onMove?.(next.x - at.x, next.y - at.y);
      at = next;
    };
    if (reducedMotion()) return moveTo(to);
    const from = pan;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / MOTION_MS));
      const e = ease(t);
      moveTo({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) });
      frame.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
  };

  return { glideTo, stop };
}
