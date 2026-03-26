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
 * @type {{
 *   bg: string,
 *   panel: string,
 *   border: string,
 *   text: string,
 *   dim: string,
 *   judgment: {high: string, moderate: string, low: string},
 *   principle: {high: string, moderate: string, low: string},
 *   theory: {high: string, moderate: string, low: string},
 *   withdrawn: string,
 *   supports: string,
 *   conflicts: string,
 *   undermines: string,
 *   depends: string,
 *   added: string,
 *   revised: string,
 *   withdrawnMark: string
 * }}
 */
export const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#e2e8f0",
  dim: "#94a3b8",
  judgment: { high: "#2563eb", moderate: "#60a5fa", low: "#93c5fd" },
  principle: { high: "#7c3aed", moderate: "#a78bfa", low: "#c4b5fd" },
  theory: { high: "#d97706", moderate: "#fbbf24", low: "#fcd34d" },
  withdrawn: "#64748b",
  supports: "#06b6d4",
  conflicts: "#f97316",
  undermines: "#eab308",
  depends: "#6b7280",
  added: "#06b6d4", // pulse ring colour for newly-added nodes in the History tab
  revised: "#eab308", // label colour for "revised" annotations
  withdrawnMark: "#f97316", // label colour for "withdrawn" annotations
};

/**
 * Opacity values for node fills, keyed by confidence level.
 * High-confidence elements render fully opaque; low-confidence ones are semi-transparent,
 * making the user's certainty visible at a glance in the graph.
 *
 * @type {{high: number, moderate: number, low: number}}
 */
export const confOp = { high: 1, moderate: 0.75, low: 0.5 };

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
 * original type or confidence.  For all other elements the fill tracks the
 * confidence level while the stroke is always the "high" shade of the type
 * colour, giving each element a recognisable border regardless of confidence.
 *
 * @param {REElement} e - The element to resolve colours for.
 * @returns {NodeColors} An object with `fill` and `stroke` CSS hex strings.
 *
 * @example
 * const { fill, stroke } = getColors({ type: "judgment", confidence: "moderate", status: "active" });
 * // fill → "#60a5fa", stroke → "#2563eb"
 */
export function getColors(e) {
  const isW = e.status === "withdrawn";
  if (isW) return { fill: C.withdrawn, stroke: C.withdrawn };
  if (e.type === "judgment")
    return { fill: C.judgment[e.confidence], stroke: C.judgment.high };
  if (e.type === "principle")
    return { fill: C.principle[e.confidence], stroke: C.principle.high };
  return { fill: C.theory[e.confidence], stroke: C.theory.high };
}
