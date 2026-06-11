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

// ─── Joint argument geometry ─────────────────────────────────────────────────

/**
 * Computes the junction point for a joint argument visualization.
 * The junction sits on the conclusion→centroid axis at half the distance,
 * but no closer than (conclusionRadius + 18) px so the arrowhead always fits.
 *
 * @param {number}   centX @param {number} centY - Premise centroid.
 * @param {Position} conclusionPos               - Conclusion node centre.
 * @param {number}   tr                          - Conclusion node radius.
 * @returns {{ jx: number, jy: number }}
 */
export function computeJunction(centX, centY, conclusionPos, tr) {
  // dist || 1: if centroid exactly coincides with conclusion (all premises overlap it),
  // ux=0/uy=1 places the junction directly below — arbitrary but avoids NaN.
  const dist = Math.hypot(centX - conclusionPos.x, centY - conclusionPos.y) || 1;
  const ux = (centX - conclusionPos.x) / dist;
  const uy = (centY - conclusionPos.y) / dist;
  const jDist = Math.max(tr + 18, dist / 2);
  return { jx: conclusionPos.x + ux * jDist, jy: conclusionPos.y + uy * jDist };
}

// ─── Joint argument grouping ──────────────────────────────────────────────────

/**
 * Splits a relation array into solo relations and multi-premise joint argument groups.
 *
 * `jointly_entails` / `jointly_precludes` relations that share an `argumentId`
 * are grouped together.  Groups with only one surviving member (e.g. after
 * visibility filtering) fall back to solo so they still render as a normal edge.
 *
 * @param {RERelation[]} relations
 * @returns {{ solo: RERelation[], jointGroups: RERelation[][] }}
 */
export function groupJointArguments(relations) {
  const groups = new Map();
  const solo = [];
  for (const r of relations) {
    if (
      (r.type === "jointly_entails" || r.type === "jointly_precludes") &&
      r.argumentId
    ) {
      if (!groups.has(r.argumentId)) groups.set(r.argumentId, []);
      groups.get(r.argumentId).push(r);
    } else {
      solo.push(r);
    }
  }
  const jointGroups = [];
  for (const group of groups.values()) {
    if (group.length > 1) jointGroups.push(group);
    else solo.push(...group);
  }
  return { solo, jointGroups };
}

// ─── Parallel edge offsets ────────────────────────────────────────────────────

const PARALLEL_SPACING = 22;

/**
 * Returns a Map from each relation to a perpendicular pixel offset so that
 * multiple edges between the same pair of nodes don't overlap.
 *
 * Offsets are symmetric around zero (e.g. -4.5, +4.5 for two edges).
 * For edges in the reverse canonical direction the raw offset is negated so
 * that all edges shift consistently relative to the canonical A→B axis.
 *
 * @param {RERelation[]} relations
 * @returns {Map<RERelation, number>}
 */
export function parallelEdgeOffsets(relations) {
  const groups = new Map();
  for (const r of relations) {
    const key = r.from < r.to ? `${r.from}↔${r.to}` : `${r.to}↔${r.from}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const offsets = new Map();
  for (const group of groups.values()) {
    const n = group.length;
    group.forEach((r, i) => {
      const raw = (i - (n - 1) / 2) * PARALLEL_SPACING;
      const canonicalFrom = r.from < r.to ? r.from : r.to;
      offsets.set(r, r.from === canonicalFrom ? raw : -raw);
    });
  }
  return offsets;
}

// ─── Hit-testing ──────────────────────────────────────────────────────────────

/**
 * Minimum distance from point (px, py) to a quadratic bezier curve,
 * approximated by sampling `samples` evenly-spaced points along the curve.
 *
 * @param {number} px @param {number} py  Test point.
 * @param {number} x0 @param {number} y0  Curve start.
 * @param {number} cx @param {number} cy  Control point.
 * @param {number} x1 @param {number} y1  Curve end.
 * @param {number} [samples=16]
 * @returns {number}
 */
export function distToQuadBezier(px, py, x0, y0, cx, cy, x1, y1, samples = 16) {
  let min = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const bx = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const by = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    const d = Math.hypot(px - bx, py - by);
    if (d < min) min = d;
  }
  return min;
}

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
