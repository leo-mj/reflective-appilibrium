/**
 * @fileoverview Colorblind-safe design tokens and colour utilities for the RE visualisation.
 *
 * All colour choices follow a policy of no red/green distinctions so the graph
 * remains readable for users with common forms of colour-vision deficiency.
 *
 * Edge colours by relation type:
 * - supports  → teal  (`#06b6d4`)
 * - conflicts → orange (`#f97316`)
 * - undermines → amber (`#eab308`)
 * - depends   → grey  (`#6b7280`)
 * - entails           → green (`#16a34a`), hollow arrowhead
 * - precludes         → rose  (`#e11d48`), hollow arrowhead
 * - jointly_entails   → green (`#16a34a`), filled arrowhead
 * - jointly_precludes → rose  (`#e11d48`), filled arrowhead
 *
 * Those hexes are the **default mode's** relation colours, and the values above
 * are duplicated as `PALETTES.default.edges` — which is what the graph actually
 * draws with, since high-contrast mode carries a second set. They stay here
 * because `C.supports` and `C.conflicts` do double duty as general UI accents,
 * the teal of a primary button and the orange of a reject, and those must not
 * move when the graph's palette does. **Anything drawing a relation should read
 * `palette.edges[type]`, not these.**
 *
 * Node fills are likewise not here. What stays is everything a viewing mode does
 * not touch: states, surfaces, and the per-type foreground tones.
 *
 * - withdrawn → uniform grey at reduced opacity
 * - rejected  → rose at reduced opacity
 *
 * @module constants/colors
 */

/** @import { NodeColors, REElement } from '../types.js' */

/**
 * The two inks anything filled with a palette colour can be written in.
 *
 * Module constants rather than entries in `C`, because `C` is a single object
 * literal and its own members cannot reference each other while it is being
 * built. They are exposed on `C` below as `onFill` and `onAmber`.
 */
const INK_ON_FILL = "#fff";
const INK_ON_LIGHT_FILL = "#0f172a";

/**
 * Master colour palette.  Import `C` wherever you need a design token —
 * avoid hardcoding hex strings in component files.
 *
 * @type {{
 *   bg: string,
 *   panel: string,
 *   border: string,
 *   text: string,
 *   dim: string,
 *   judgment: {text: string},
 *   principle: {text: string},
 *   theory: {text: string},
 *   withdrawn: string,
 *   rejected: string,
 *   onFill: string,
 *   onAmber: string,
 *   danger: string,
 *   dangerSurface: string,
 *   dangerInk: string,
 *   supports: string,
 *   supportsText: string,
 *   conflicts: string,
 *   undermines: string,
 *   depends: string,
 *   entails: string,
 *   precludes: string,
 *   jointly_entails: string,
 *   jointly_precludes: string,
 *   added: string,
 *   revised: string,
 *   withdrawnMark: string,
 *   rejectedMark: string
 * }}
 */
export const C = {
  bg: "var(--c-bg)",
  panel: "var(--c-panel)",
  border: "var(--c-border)",
  text: "var(--c-text)",
  dim: "var(--c-dim)",
  // Each element type in two roles that are *not* the graph node.
  //
  // `accent` is the type's canonical hue for chrome — a card's left border, a
  // chart series, a checkbox tint, a legend swatch. Fixed, and deliberately so:
  // these stand for the type wherever it appears, and having a chart series
  // change colour because the graph switched mode would be nonsense.
  //
  // `text` is the same idea as a foreground. Theme-dependent, hence a CSS
  // variable (see the note in index.css), because `accent` does not clear AA as
  // type on both panels.
  //
  // Node fills are neither of these. They vary per viewing mode and live in
  // constants/palettes.js, reached through `usePalette()`.
  judgment: { accent: "#2563eb", text: "var(--c-judgment-text)" },
  principle: { accent: "#7c3aed", text: "var(--c-principle-text)" },
  theory: { accent: "#d97706", text: "var(--c-theory-text)" },
  withdrawn: "#64748b",
  rejected: "#fb7185",
  // Ink for text sitting *on* a palette fill — a badge, a filled button. Which
  // of the two applies is a property of the colour, not of what it stands for,
  // so prefer `inkOn(fill)` over naming one by hand.
  onFill: INK_ON_FILL,
  onAmber: INK_ON_LIGHT_FILL,
  // Destructive actions and error surfaces.
  danger: "#dc2626",
  dangerSurface: "#7c1d1d44",
  dangerInk: "#fca5a5",
  supports: "#06b6d4",
  /** `supports` as a foreground — the edge teal is illegible on the light panel. */
  supportsText: "var(--c-supports-text)",
  conflicts: "#f97316",
  undermines: "#eab308",
  depends: "#6b7280",
  entails: "#16a34a",
  precludes: "#e11d48",
  jointly_entails: "#16a34a",
  jointly_precludes: "#e11d48",
  added: "#06b6d4", // pulse ring colour for newly-added nodes in the History tab
  revised: "#eab308", // label colour for "revised" annotations
  withdrawnMark: "#f97316", // label colour for "withdrawn" annotations
  rejectedMark: "#fb7185", // label colour for "rejected" annotations
};

/**
 * @param {string} hex - `#rgb` or `#rrggbb`.
 * @returns {[number,number,number]}
 */
function hexToRgb(hex) {
  let body = hex.slice(1);
  // Shorthand has to be expanded, not parsed: "fff" reads as 0x000fff, which is
  // a blue, and every caller here means white by it.
  if (body.length === 3) body = body.replace(/./g, (c) => c + c);
  const n = parseInt(body, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─── Element types ────────────────────────────────────────────────────────────

/**
 * The three element types' tokens, keyed by `REElement.type`.
 *
 * Components that need a type's colour should go through {@link typeTokens}
 * rather than keeping their own `{judgment, principle, theory}` map — there
 * were three such maps, and they had already drifted apart on which tone to use
 * for text.
 */
const TYPE_TOKENS = {
  judgment: C.judgment,
  principle: C.principle,
  theory: C.theory,
};

/**
 * Tokens for an element type.
 *
 * Always yields the `text` tone. Pass a palette to get that mode's `low`/`high`
 * fills and `stroke` as well — anything drawing a node shape needs them, and
 * they are mode-dependent, so they cannot come from a module constant.
 *
 * Falls back to judgment for an unknown type, so a caller reading a
 * half-validated element renders something rather than throwing.
 *
 * @param {string} type - "judgment" | "principle" | "theory".
 * @param {import('./palettes.js').Palette} [palette] - From `usePalette()`.
 * @returns {{text: string, low?: string, high?: string, stroke?: string}}
 *
 * `text` is a CSS variable that varies by **theme only**. It is for prose that
 * names a type — a heading, a sentence about judgments — never for anything sat
 * beside a node or a node-coloured chip, because in high-contrast mode it stays
 * on the default ramp while everything around it moves. The text panel's id
 * badge made exactly that mistake: tint and border followed the palette, the ink
 * did not, and a magenta principle node ended up with a violet badge.
 *
 * @example
 * const p = usePalette();
 * <rect fill={typeTokens(el.type, p).high} />
 * // A chip that has to match the node: take the fill and ask for its ink.
 * const fill = typeTokens(el.type, p).high;
 * <span style={{ background: fill, color: inkOn(fill) }}>{el.id}</span>
 */
export function typeTokens(type, palette) {
  const known = TYPE_TOKENS[type] ? type : "judgment";
  return palette ? { ...palette[known], ...TYPE_TOKENS[known] } : TYPE_TOKENS[known];
}

// ─── Clusters ─────────────────────────────────────────────────────────────────

/**
 * Categorical tints that tell one coherent cluster from the next.
 *
 * Cycled by index, so the count is what limits how many clusters read as
 * distinct, not how many exist. These are their own literals rather than
 * references to the element tones: a cluster is not a type, and the element
 * fills now differ per viewing mode, which would have left a cluster changing
 * colour when the theme changed.
 */
const CLUSTER_FILLS = [
  "#06b6d4", // = C.supports
  "#7c3aed",
  "#d97706",
  "#2563eb",
  "#16a34a", // = C.entails
  "#db2777",
];

/**
 * A cluster's tint, for borders and fills.
 *
 * @param {number} i - Cluster index; wraps.
 */
export function clusterColor(i) {
  return CLUSTER_FILLS[i % CLUSTER_FILLS.length];
}

/**
 * The same cluster's tint as *type*.
 *
 * Separate because the fills are fixed hues and the panel behind them is not:
 * four of the six failed AA as label text on one theme or the other, and which
 * four depends on the theme. These are theme-dependent — see index.css.
 *
 * @param {number} i - Cluster index; wraps.
 */
export function clusterTextColor(i) {
  return `var(--c-cluster-${i % CLUSTER_FILLS.length}-text)`;
}

// ─── Ink ──────────────────────────────────────────────────────────────────────

/** WCAG relative luminance of a hex colour. @param {string} hex */
function luminance(hex) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The readable ink for text drawn on `fill`.
 *
 * Which ink reads is rarely obvious by eye, and the palette moves: white on the
 * judgment blue is 5.17:1, on the theory amber 3.19:1, on `undermines` 1.72:1.
 * Asking is what keeps a caller correct when the colour under it changes — the
 * one place that named an ink by hand rather than asking went under AA the
 * moment its background was re-toned.
 *
 * Non-hex values (the `var(--…)` tokens) cannot be measured, so they get the
 * default rather than throwing.
 *
 * @param {string} fill - A hex colour, e.g. from `getColors(el).fill`.
 * @returns {string} `C.onFill` or `C.onAmber`.
 */
export function inkOn(fill) {
  if (typeof fill !== "string" || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(fill))
    return INK_ON_FILL;
  return contrast(fill, INK_ON_FILL) >= contrast(fill, INK_ON_LIGHT_FILL)
    ? INK_ON_FILL
    : INK_ON_LIGHT_FILL;
}

/** @param {[number,number,number]} rgb @returns {string} */
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/**
 * Linearly interpolate between two hex colours.
 * @param {string} hexLow  - Colour at t=0.
 * @param {string} hexHigh - Colour at t=1.
 * @param {number} t       - Value in [0, 1].
 * @returns {string} Interpolated hex colour.
 */
function lerpColor(hexLow, hexHigh, t) {
  const lo = hexToRgb(hexLow);
  const hi = hexToRgb(hexHigh);
  return rgbToHex(lo.map((v, i) => v + (hi[i] - v) * t));
}

/**
 * CSS `transition` string applied to node `<g>` elements and edges.
 * Controls the fade duration when elements appear, disappear, or change opacity
 * (e.g. when the "show withdrawn" toggle changes state).
 *
 * @type {string}
 */
export const TRANSITION = "opacity 1.2s ease-in-out";

/**
 * Resolves the fill and stroke colours for a graph node given the element's
 * current type, confidence, and status.
 *
 * Withdrawn and rejected elements render in their uniform state colour whatever
 * their type or confidence. Everything else is interpolated between the type's
 * `low` and `high` endpoints in the given palette, outlined in that ramp's
 * `stroke` — so how far the fill sits from its own outline is one of the two
 * confidence cues, the other being the node's radius.
 *
 * The result is the colour that reaches the screen: nothing downstream fades it,
 * which is what lets the label contrast be checked here rather than in a browser.
 *
 * @param {REElement} e - The element to resolve colours for.
 * @param {import('./palettes.js').Palette} palette - From `usePalette()`, or
 *   `resolvePalette()` outside React.
 * @returns {NodeColors} An object with `fill` and `stroke` CSS hex strings.
 *
 * @example
 * const palette = usePalette();
 * const { fill, stroke } = getColors({ type: "judgment", confidence: 0.67 }, palette);
 */
export function getColors(e, palette) {
  if (e.status === "withdrawn") return { fill: C.withdrawn, stroke: C.withdrawn };
  if (e.status === "rejected") return { fill: C.rejected, stroke: C.rejected };
  const ramp = palette[e.type] ?? palette.judgment;
  const t = Math.max(0, Math.min(1, e.confidence ?? 1));
  return { fill: lerpColor(ramp.low, ramp.high, t), stroke: ramp.stroke };
}
