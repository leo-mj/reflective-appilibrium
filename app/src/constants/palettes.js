/**
 * @fileoverview Node fill ramps and label ink, one set per viewing mode.
 *
 * Two modes, and the split between them is the whole design:
 *
 * - **default** is the palette judged by eye — blue judgments, violet
 *   principles, amber theories, pale at low confidence and saturated at high,
 *   with white ids on them. It does *not* guarantee WCAG AA, and that is a
 *   decision rather than an oversight. No single ink can serve this ramp: it
 *   runs from tints that need dark type to saturated tones that need light,
 *   crossing at about 0.183 relative luminance. White clears comfortably at the
 *   saturated end (5.2–5.7:1) and falls away toward the pale one.
 * - **accessible** is the compliant path, offered as a mode rather than forced
 *   on everyone. Every id clears AAA (7:1), and the hues separate on the
 *   blue–yellow axis that red-green colour deficiency leaves intact.
 *
 * Weight follows the ink rather than being set beside it — see {@link inkWeight}.
 *
 * Ramps run `low` (confidence 0) → `high` (confidence 1) and are interpolated by
 * {@link module:constants/colors.getColors}. `stroke` outlines the node at every
 * confidence; it is what keeps a pale fill legible against a pale page.
 *
 * @module constants/palettes
 */

/** The compliant mode writes on pale fills, so its ink is the dark one. */
const INK_DARK = "#000000";

/**
 * @typedef {Object} TypeRamp
 * @property {string} low    - Fill at confidence 0.
 * @property {string} high   - Fill at confidence 1.
 * @property {string} stroke - 2px outline, at every confidence.
 */

/**
 * @typedef {Object} Palette
 * @property {string}   id   - Stable key, also what the tests assert on.
 * @property {string}   ink  - The one colour every node id is written in.
 * @property {TypeRamp} judgment
 * @property {TypeRamp} principle
 * @property {TypeRamp} theory
 */

/** @type {Record<string, Palette>} */
export const PALETTES = {
  default: {
    id: "default",
    ink: "#ffffff",
    judgment: { low: "#93c5fd", high: "#2563eb", stroke: "#2563eb" },
    principle: { low: "#c4b5fd", high: "#7c3aed", stroke: "#7c3aed" },
    theory: { low: "#fcd34d", high: "#d97706", stroke: "#d97706" },
  },
  // Pale throughout, so black ink has room to spare wherever the ramp is. Reads
  // against the dark page and the light one alike, which is why it is one set
  // rather than a variant per theme.
  accessible: {
    id: "accessible",
    ink: INK_DARK,
    judgment: { low: "#bfdbfe", high: "#60a5fa", stroke: "#1d4ed8" },
    principle: { low: "#f5d0fe", high: "#e879f9", stroke: "#a21caf" },
    theory: { low: "#fef08a", high: "#facc15", stroke: "#a16207" },
  },
};

/**
 * The palette in force.
 *
 * The theme is not a parameter: the default fills are the same on both grounds,
 * as they were before modes existed. Only the accessible switch changes them.
 *
 * @param {boolean} [accessible]
 * @returns {Palette}
 */
export function resolvePalette(accessible = false) {
  return accessible ? PALETTES.accessible : PALETTES.default;
}

/**
 * Type weight for an id written in `ink`.
 *
 * Tied to the ink rather than set by hand: white glyphs on a saturated fill go
 * fragile at 13px and need the weight, while black ones go blobby with it.
 *
 * @param {string} ink
 * @returns {"bold" | "normal"}
 */
export function inkWeight(ink) {
  const n = parseInt(ink.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Rough perceived lightness is enough to tell "light ink" from "dark ink".
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "bold" : "normal";
}
