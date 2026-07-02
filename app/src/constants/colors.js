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
 * Node colours by element type, shaded by confidence level:
 * - judgment  → blue shades
 * - principle → purple shades
 * - theory    → amber shades
 * - withdrawn → uniform grey at reduced opacity
 *
 * @module constants/colors
 */

/** @import { NodeColors, REElement } from '../types.js' */

/**
 * Master colour palette.  Import `C` wherever you need a design token —
 * avoid hardcoding hex strings in component files.
 *
 * Each element type has `high` (full confidence) and `low` (zero confidence)
 * endpoint colours; intermediate values are interpolated by `getColors`.
 *
 * @type {{
 *   bg: string,
 *   panel: string,
 *   border: string,
 *   text: string,
 *   dim: string,
 *   judgment: {high: string, low: string},
 *   principle: {high: string, low: string},
 *   theory: {high: string, low: string},
 *   withdrawn: string,
 *   rejected: string,
 *   supports: string,
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
  judgment: { high: "#2563eb", low: "#93c5fd" },
  principle: { high: "#7c3aed", low: "#c4b5fd" },
  theory: { high: "#d97706", low: "#fcd34d" },
  withdrawn: "#64748b",
  rejected: "#fb7185",
  supports: "#06b6d4",
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

/** @param {string} hex @returns {[number,number,number]} */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
 * Node fill opacity as a function of confidence (0–1).
 * Maps linearly from 0.5 at confidence=0 to 1.0 at confidence=1.
 *
 * @param {number} confidence - Element confidence in [0, 1].
 * @returns {number} Opacity in [0.5, 1].
 */
export function confOp(confidence) {
  return 0.5 + 0.5 * Math.max(0, Math.min(1, confidence));
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
 * Withdrawn elements always render in the uniform grey regardless of their
 * original type or confidence.  For all other elements the fill is interpolated
 * between the type's low- and high-confidence endpoint colours, while the
 * stroke is always the "high" shade.
 *
 * @param {REElement} e - The element to resolve colours for.
 * @returns {NodeColors} An object with `fill` and `stroke` CSS hex strings.
 *
 * @example
 * const { fill, stroke } = getColors({ type: "judgment", confidence: 0.67, status: "active" });
 */
export function getColors(e) {
  const isW = e.status === "withdrawn";
  if (isW) return { fill: C.withdrawn, stroke: C.withdrawn };
  const isR = e.status === "rejected";
  if (isR) return { fill: C.rejected, stroke: C.rejected };
  const t = Math.max(0, Math.min(1, e.confidence ?? 1));
  if (e.type === "judgment")
    return { fill: lerpColor(C.judgment.low, C.judgment.high, t), stroke: C.judgment.high };
  if (e.type === "principle")
    return { fill: lerpColor(C.principle.low, C.principle.high, t), stroke: C.principle.high };
  return { fill: lerpColor(C.theory.low, C.theory.high, t), stroke: C.theory.high };
}
