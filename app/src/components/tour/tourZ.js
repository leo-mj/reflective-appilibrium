/**
 * @fileoverview Stacking order shared by both tours.
 *
 * dim < the narrow ☰ menu the phone tour walks < ring < card. The wide tour's
 * panel sits at `card` and its spotlight ring at `ring`, so a ringed control
 * stays bright while the rest of the app dims behind both.
 *
 * @module components/tour/tourZ
 */

export const TOUR_Z = { dim: 910, menu: 916, ring: 917, card: 920 };
