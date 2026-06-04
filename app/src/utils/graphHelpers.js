/**
 * @fileoverview Pure geometry and graph-traversal helpers shared between
 * {@link module:components/Graph} and {@link module:components/HistoryTab}.
 *
 * All functions are stateless and have no React or D3 dependencies.
 *
 * @module utils/graphHelpers
 */

/** @import { REElement, RERelation, Position } from '../types.js' */

// ─── Node sizing ─────────────────────────────────────────────────────────────

/** Base visual radii by element type (at confidence = 1). */
const BASE_RADIUS = { principle: 28, theory: 22, judgment: 18 };

/**
 * Visual radius of a node scaled by confidence.
 * Confidence 1.0 → full base radius; confidence 0.0 → 50% of base radius.
 *
 * @param {string} type       - Element type ('judgment' | 'principle' | 'theory').
 * @param {number} [confidence=1] - Element confidence in [0, 1].
 * @returns {number} Radius in SVG pixels.
 */
export function nodeRadius(type, confidence = 1) {
  const base = BASE_RADIUS[type] ?? 18;
  const t = Math.max(0, Math.min(1, confidence));
  return base * (0.5 + 0.5 * t);
}

/**
 * Hit-test radius for pointer click detection — slightly larger than the
 * visual radius so small nodes are easier to tap.
 *
 * @param {string} type       - Element type.
 * @param {number} [confidence=1] - Element confidence in [0, 1].
 * @returns {number}
 */
export function hitRadius(type, confidence = 1) {
  return nodeRadius(type, confidence) + 6;
}

// ─── Edge styling ─────────────────────────────────────────────────────────────

/**
 * SVG stroke-dasharray value for a relation type.
 *
 * @param {string} relationType - Relation type.
 * @returns {string} CSS stroke-dasharray value.
 */
export function edgeDashArray(relationType) {
  if (relationType === "conflicts") return "8,4";
  if (relationType === "undermines") return "4,4";
  return "none";
}

// ─── Arrow geometry ───────────────────────────────────────────────────────────

/**
 * Computes all SVG coordinates needed to render a directed arrow between two nodes.
 *
 * The visible line starts inset from the source centre by `sr` and ends at the
 * arrowhead base, which is 10 px behind the tip.  The tip itself is inset from
 * the target centre by `tr` so the arrowhead lands on the node's border.
 *
 * @param {Position} sp - Source node centre.
 * @param {Position} tp - Target node centre.
 * @param {number}   sr - Source node radius (line start inset).
 * @param {number}   tr - Target node radius (tip inset).
 * @returns {{ x1: number, y1: number, x2: number, y2: number,
 *             tipX: number, tipY: number, perpX: number, perpY: number }}
 *   `x1,y1` → line start; `x2,y2` → line end / arrowhead base;
 *   `tipX,tipY` → arrowhead tip; `perpX,perpY` → perpendicular unit vector.
 */
export function arrowGeometry(sp, tp, sr, tr) {
  const dx = tp.x - sp.x,
    dy = tp.y - sp.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist,
    uy = dy / dist; // unit vector along the edge
  const tipX = tp.x - ux * tr;
  const tipY = tp.y - uy * tr;
  return {
    x1: sp.x + ux * sr,
    y1: sp.y + uy * sr,
    x2: tipX - ux * 10,
    y2: tipY - uy * 10,
    tipX,
    tipY,
    perpX: -uy,
    perpY: ux, // perpendicular unit vector (for arrowhead width)
  };
}

// ─── Graph traversal ──────────────────────────────────────────────────────────

/**
 * Returns the set of element IDs that should be highlighted when `selectedId`
 * is selected: the node itself plus every node directly connected to it by any
 * visible relation in either direction.
 *
 * Used by both {@link module:components/Graph} and {@link module:components/TextTab}.
 *
 * @param {string}       selectedId - ID of the selected element.
 * @param {RERelation[]} visRels    - Currently visible relations.
 * @returns {Set<string>}
 */
export function getNeighbours(selectedId, visRels) {
  const ids = new Set([selectedId]);
  visRels.forEach((r) => {
    if (r.from === selectedId) ids.add(r.to);
    if (r.to === selectedId) ids.add(r.from);
  });
  return ids;
}

// ─── Hit-testing ──────────────────────────────────────────────────────────────

/**
 * Returns the shortest distance from point `(px, py)` to the line segment
 * `(ax, ay) → (bx, by)`.  Used for edge click hit-testing in the graph.
 *
 * @param {number} px @param {number} py  Point to test.
 * @param {number} ax @param {number} ay  Segment start.
 * @param {number} bx @param {number} by  Segment end.
 * @returns {number}
 */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
