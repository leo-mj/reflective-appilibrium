/**
 * @fileoverview Hook that holds a size steady through changes too small to be
 * worth reacting to.
 * @module hooks/useCoarseDims
 */

/** @import { Dims } from '../types.js' */

import { useState } from "react";

/**
 * Pixels of change to tolerate before reporting a new size.
 *
 * Chosen to sit above the browser chrome that comes and goes on its own — a
 * mobile URL bar is 60–90px, an on-screen keyboard a few hundred — and below a
 * rotation or a panel opening, which change a side by more than this and are
 * exactly the changes worth reacting to.
 */
const DEFAULT_THRESHOLD = 300;

/**
 * Returns `dims`, but only lets a new value through once a side has moved by
 * more than `threshold` pixels.
 *
 * The problem this solves is that `window.innerHeight` is not a stable number
 * on a phone. Scrolling collapses the URL bar and focusing an input raises the
 * keyboard; both fire `resize` with a height tens or hundreds of pixels
 * different from the one before. Anything keyed on that height is rebuilt every
 * time the reader scrolls or types.
 *
 * For the force simulation in {@link module:hooks/useStablePositions} that is
 * worse than wasted work. The simulation re-centres on the new height and the
 * nodes drift toward it — but the graph auto-fits only once, on mount, so the
 * view stays where the reader left it and the drift happens underneath them.
 *
 * Debouncing would not help: it delays the restart rather than avoiding it.
 * What is wanted is a size that ignores changes too small to re-lay-out for.
 *
 * @param {Dims}   dims        - Live dimensions.
 * @param {number} [threshold] - Pixels of change to tolerate. Defaults to 300.
 * @returns {Dims} The last dimensions that differed from their predecessor by
 *   more than `threshold`, starting from the first ones passed.
 *
 * @example
 * // Re-centres on a rotation or a panel opening, not on a URL bar collapsing.
 * const simDims = useCoarseDims({ w: graphW, h: dims.h * 0.8 });
 */
export function useCoarseDims(dims, threshold = DEFAULT_THRESHOLD) {
  // State adjusted during render rather than in an effect: React re-runs the
  // component before committing, so consumers never see the value we are about
  // to discard and no layout is ever started on it.
  const [coarse, setCoarse] = useState(dims);
  if (
    Math.abs(dims.w - coarse.w) > threshold ||
    Math.abs(dims.h - coarse.h) > threshold
  ) {
    setCoarse(dims);
  }
  return coarse;
}
