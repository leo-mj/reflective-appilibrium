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

import { inkOn } from "./colors.js";

/** The compliant mode writes on pale fills, so its ink is the dark one. */
const INK_DARK = "#000000";

/**
 * @typedef {Object} TypeRamp
 * @property {string} low    - Fill at confidence 0.
 * @property {string} high   - Fill at confidence 1.
 * @property {string} stroke - 2px outline, at every confidence.
 */

/**
 * @typedef {Object} EdgeSet
 * @property {string} supports
 * @property {string} conflicts
 * @property {string} undermines
 * @property {string} depends
 * @property {string} entails
 * @property {string} precludes
 * @property {string} jointly_entails
 * @property {string} jointly_precludes
 */

/**
 * @typedef {Object} Palette
 * @property {string}   id   - Stable key, also what the tests assert on.
 * @property {string}   ink  - The one colour every node id is written in.
 * @property {TypeRamp} judgment
 * @property {TypeRamp} principle
 * @property {TypeRamp} theory
 * @property {EdgeSet}  edges - Relation line colours. See the note below.
 */

/**
 * The relation colours of the default mode, unchanged from what they have always
 * been. Kept here rather than read from `constants/colors.js` because the
 * accessible mode needs a second set, and a palette that carried only half its
 * colours would be the kind of thing you have to remember.
 *
 * `C.supports` and friends stay in colors.js: they do double duty there as
 * general UI accents — the teal on the home page, the orange of a reject button
 * — and those must not move when the graph's palette does.
 */
const DEFAULT_EDGES = {
  supports: "#06b6d4",
  conflicts: "#f97316",
  undermines: "#eab308",
  depends: "#6b7280",
  entails: "#16a34a",
  precludes: "#e11d48",
  jointly_entails: "#16a34a",
  jointly_precludes: "#e11d48",
};

/**
 * The same six hues, moved into the luminance band that is legible on both
 * grounds *and* as type on the header chip.
 *
 * The band is narrow and worth stating. An edge is a line on the canvas, which
 * is near-black in one theme and near-white in the other, so it wants relative
 * luminance between about 0.13 and 0.28 to clear 3:1 on both. The same colours
 * name the Arguments and Relations headers, which in this mode sit on a black
 * chip and so want at least 0.175 to clear AA as text. That leaves 0.175–0.265,
 * and every colour here sits inside it.
 *
 * They are deliberately *not* all at one luminance: luminance is the channel
 * red-green colour deficiency leaves intact, so flattening it would remove the
 * cue that survives. The dialectical four spread 0.180–0.249.
 *
 * What this set fixes is contrast, not hue separation. Orange, yellow and green
 * remain confusable for a red-green deficiency, and separating them would mean
 * abandoning the semantic mapping the legend teaches. The redundancy that
 * carries them apart is the one already there: dash pattern and arrowhead.
 */
const ACCESSIBLE_EDGES = {
  supports: "#0596af",
  conflicts: "#d25905",
  undermines: "#a57e06",
  depends: "#6f7684",
  entails: "#159e48",
  precludes: "#e53159",
  jointly_entails: "#159e48",
  jointly_precludes: "#e53159",
};

/** @type {Record<string, Palette>} */
export const PALETTES = {
  default: {
    id: "default",
    ink: "#ffffff",
    judgment: { low: "#93c5fd", high: "#2563eb", stroke: "#2563eb" },
    principle: { low: "#c4b5fd", high: "#7c3aed", stroke: "#7c3aed" },
    theory: { low: "#fcd34d", high: "#d97706", stroke: "#d97706" },
    edges: DEFAULT_EDGES,
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
    edges: ACCESSIBLE_EDGES,
  },
};

/**
 * What an assist tab's header wears: the graph constant for whatever that tab
 * produces, and the ink that goes on it.
 *
 * `fill` is exactly the constant, never a tuned-for-legibility variant. In the
 * default mode it is used as *type*, where several are under AA — the judgment
 * blue reads 2.83:1 on the dark panel — and that is the same decision the node
 * ramp already embodies: the default palette is judged by eye, and high-contrast
 * mode is the compliant path.
 *
 * In that mode the header becomes a **badge**, filled with `fill` and written in
 * `ink` — which is to say, it is drawn the way the node itself is drawn. For an
 * element type that is literally the palette's own ink, the one every node id is
 * written in. For a relation colour, which no node wears, it is whichever of the
 * two inks contrasts better, exactly as the graph's `+J/+P/+T` buttons decide.
 *
 * @param {Palette} palette
 * @param {string}  tab  A key from ASSIST_TABS.
 * @returns {{fill: string, ink: string}|null} `null` for a tab that names no
 *   element or relation — a process review is prose about the whole process, so
 *   it borrows no colour from the graph and takes no badge either.
 */
export function headerAccent(palette, tab) {
  const node = (type) => ({ fill: palette[type].high, ink: palette.ink });
  const edge = (type) => ({
    fill: palette.edges[type],
    ink: inkOn(palette.edges[type]),
  });
  switch (tab) {
    case "questionnaire":
    case "elicitJudgments":
      return node("judgment");
    case "suggestPrinciples":
      return node("principle");
    case "suggestTheories":
      return node("theory");
    case "detectArguments":
      return edge("entails");
    case "suggestRelations":
      return edge("supports");
    default:
      return null;
  }
}

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
