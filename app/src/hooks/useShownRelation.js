/**
 * @fileoverview The edge whose explanation is showing — under the mouse, or
 * last tapped — on a canvas that shows one (`RelationLabel`).
 *
 * @module hooks/useShownRelation
 */

import { useState } from "react";

/**
 * @returns {[object|null, function(object|null): void]} The hit
 *   (`{ rel, rels, x, y }`, from `relationAt`) and a setter that changes state
 *   only when the edge does — a pointer moving along one edge asks on every
 *   move, and each fresh hit object would otherwise re-render the canvas.
 */
export function useShownRelation() {
  const [shown, setShown] = useState(null);
  const show = (hit) => setShown((prev) => (prev?.rel === hit?.rel ? prev : hit));
  return [shown, show];
}
