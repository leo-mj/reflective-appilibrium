/**
 * @fileoverview Geometry and stacking order the tours share with the app they
 * cover.
 *
 * Kept apart from the components so anything that has to make room for a tour,
 * or lift itself above one, can say so without importing a tour.
 *
 * @module components/tour/tourZ
 */

/** dim < the narrow ☰ menu the phone tour walks < ring < the wide tour's column. */
export const TOUR_Z = { dim: 910, menu: 916, ring: 917, card: 920 };

/**
 * Width the wide tour's column opens at, and the width its handle resets to.
 * The app is padded by whatever it is *currently* at while the tour is open,
 * and anything that centres itself on the viewport rather than on the app — a
 * modal — has to shift by half of that to stay clear. The current one lives in
 * {@link module:components/tour/tourWidth}, since the reader can drag it; this
 * is only where it starts.
 */
export const TOUR_W = 460;

/**
 * The narrow tour is the same column laid along the bottom edge, and the app is
 * padded by its height the way the wide one pads by its width.
 *
 * Two heights rather than a free drag. `base` leaves the graph the larger
 * share, because the chapters that name elements are read against it; `tall` is
 * for the opening prose, which has nothing to watch. The reader moves between
 * them with the sheet's handle.
 */
export const TOUR_SHEET = { base: 0.46, tall: 0.82, min: 220 };

/**
 * Height in pixels of the narrow tour's sheet.
 *
 * Both the sheet and the app behind it work this out from the same viewport, so
 * only the expanded flag has to travel between them.
 *
 * @param {number}  vh       - Viewport height.
 * @param {boolean} expanded
 * @returns {number}
 */
export function sheetHeight(vh, expanded) {
  const wanted = vh * (expanded ? TOUR_SHEET.tall : TOUR_SHEET.base);
  // The floor is what a paragraph and the footer need. A phone held landscape
  // is short enough for the base fraction to fall under it, and the ceiling
  // keeps that floor from swallowing the graph on a shorter screen still.
  return Math.round(
    Math.min(vh * TOUR_SHEET.tall, Math.max(TOUR_SHEET.min, wanted)),
  );
}
