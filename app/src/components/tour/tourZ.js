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
 * Width of the wide tour's column. The app is padded by this much while the
 * tour is open, and anything that centres itself on the viewport rather than on
 * the app — a modal — has to shift by half of it to stay clear.
 */
export const TOUR_W = 460;
