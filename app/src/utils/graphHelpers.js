/**
 * @fileoverview Pure geometry and graph-traversal helpers shared between
 * {@link module:components/Graph} and {@link module:components/HistoryTab}.
 *
 * All functions are stateless and have no React or D3 dependencies.
 *
 * @module utils/graphHelpers
 */

/** @import { REElement, RERelation, Position } from '../types.js' */

import { groupRadius } from "./groupUtils.js";

// ─── Node sizing ─────────────────────────────────────────────────────────────

/** Base visual radii by element type, at the middle of the confidence range. */
const BASE_RADIUS = { principle: 28, theory: 22, judgment: 18 };

/**
 * How far confidence moves the radius, as a fraction of the base.
 *
 * Confidence 0 → `MIN`, confidence 1 → `MIN + SPAN`. Size is the main way
 * confidence reads on the graph, so the ends are set far apart on purpose:
 * 1.85× the radius is 3.4× the area, and area is what the eye compares.
 *
 * The floor is set by the label, not by taste. The id is drawn inside the node,
 * and 0.65 is the smallest that still contains a three-character id at 11px
 * bold — a judgment there is 23px across against a ~20px label.
 */
const RADIUS_MIN = 0.65;
const RADIUS_SPAN = 0.55;

/**
 * Visual radius of a node scaled by confidence.
 * Confidence 1.0 → 120% of the base radius; confidence 0.0 → 65%.
 *
 * @param {string} type       - Element type ('judgment' | 'principle' | 'theory').
 * @param {number} [confidence=1] - Element confidence in [0, 1].
 * @returns {number} Radius in SVG pixels.
 */
export function nodeRadius(type, confidence = 1) {
  const base = BASE_RADIUS[type] ?? 18;
  const t = Math.max(0, Math.min(1, confidence));
  return base * (RADIUS_MIN + RADIUS_SPAN * t);
}

/**
 * Type size for a node's id.
 *
 * Capped by the *smallest* node of that type, not the average one: the id sits
 * inside the shape, and the shape shrinks to `RADIUS_MIN` (65%) of its base at
 * zero confidence. The binding case is a three-character id on a judgment
 * circle, where the room at the glyph's own height is
 * `2·√(r² − halfHeight²) = 22px` against a width of ~1.65× the font size — which
 * puts the ceiling at 13. Principles are drawn on a 40px-wide rect and have room
 * to spare; theories are diamonds, tighter per pixel of radius but never more
 * than two characters.
 *
 * Raising these further means raising {@link RADIUS_MIN},
 * which costs confidence range. `e2e/palette.spec.js` measures the real glyph
 * boxes and fails if a label outgrows its shape.
 *
 * Shared by the canvas and the SVG export, which draws a statement card's
 * badge the way the canvas does.
 *
 * @param {string} type
 * @returns {number}
 */
export function nodeLabelSize(type) {
  return type === "principle" ? 16 : 13;
}

/** How far past its outline a node stays clickable. */
const HIT_PADDING = 8;
/** Floor on a touch target, whatever the node's own size. */
const MIN_HIT_RADIUS = 18;

/**
 * Hit-test radius for pointer click detection — larger than the visual radius so
 * small nodes are easier to tap.
 *
 * The floor guards the small end of the size range against a touch target too
 * small to hit. It does not bind at the current `RADIUS_MIN`; it is here so that
 * lowering that does not silently make the smallest nodes unpickable.
 *
 * @param {string} type       - Element type.
 * @param {number} [confidence=1] - Element confidence in [0, 1].
 * @returns {number}
 */
export function hitRadius(type, confidence = 1) {
  return Math.max(nodeRadius(type, confidence) + HIT_PADDING, MIN_HIT_RADIUS);
}

/**
 * Visual radius of whatever the graph is drawing at that spot.
 *
 * The same thing as {@link nodeRadius} for an element, and the reason to prefer
 * it: a collapsed group is drawn as a node too, and its size comes from how
 * many members it holds rather than from a type and a confidence it does not
 * have. Anything that has the element in hand should ask this instead of
 * picking `type` and `confidence` off it — that pair is precisely what a group
 * node lacks, and the fallback it lands on is a judgment-sized disc under a
 * shape three times the size.
 *
 * @param {REElement} el
 * @returns {number} Radius in SVG pixels.
 */
export function elementRadius(el) {
  if (el?.type === "group")
    return groupRadius(el.memberIds?.length ?? 0, el.label);
  return nodeRadius(el?.type, el?.confidence);
}

/**
 * How far from a node's centre its border lies, heading towards `(dx, dy)` —
 * where an edge leaving that way starts, or one arriving from there ends.
 *
 * The node's radius in any direction, except for the statement view's cards
 * (`card` on a display copy, from `statementCard`), which are wide boxes: an
 * edge drawn to a radius would stop short of one on its sides and run into it
 * at top and bottom. Ask this rather than {@link elementRadius} wherever an
 * edge meets a node.
 *
 * @param {REElement & { card?: { hw: number, hh: number } }} el
 * @param {number} dx
 * @param {number} dy
 * @returns {number}
 */
export function boundaryDistance(el, dx, dy) {
  if (!el?.card) return elementRadius(el);
  const { hw, hh } = el.card;
  const len = Math.hypot(dx, dy) || 1;
  const ux = Math.abs(dx / len);
  const uy = Math.abs(dy / len);
  // No direction at all (two nodes on one spot): any border point will do.
  if (!ux && !uy) return hh;
  return Math.min(ux ? hw / ux : Infinity, uy ? hh / uy : Infinity);
}

/**
 * Whether a point in simulation coordinates lands on a node drawn at `pos`:
 * within its hit radius, or on a statement card with the same padding.
 *
 * @param {REElement & { card?: { hw: number, hh: number } }} el
 * @param {Position} pos
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function hitsElement(el, pos, x, y) {
  if (el?.card)
    return (
      Math.abs(x - pos.x) <= el.card.hw + HIT_PADDING / 2 &&
      Math.abs(y - pos.y) <= el.card.hh + HIT_PADDING / 2
    );
  return (pos.x - x) ** 2 + (pos.y - y) ** 2 < elementHitRadius(el) ** 2;
}

/**
 * Hit-test radius for whatever the graph is drawing at that spot.
 * {@link hitRadius} is to {@link nodeRadius} as this is to {@link elementRadius}.
 *
 * @param {REElement} el
 * @returns {number}
 */
export function elementHitRadius(el) {
  return Math.max(elementRadius(el) + HIT_PADDING, MIN_HIT_RADIUS);
}

// ─── Edge styling ─────────────────────────────────────────────────────────────

/**
 * What each relation type is called on screen — the legend's labels, and the
 * heading of the box an edge's explanation shows in. One map, so the two
 * cannot name a type differently.
 */
export const RELATION_LABELS = {
  supports: "Supports",
  conflicts: "Conflicts",
  undermines: "Undermines",
  entails: "Entails",
  jointly_entails: "Jointly Entails",
  precludes: "Precludes",
  jointly_precludes: "Jointly Precludes",
};

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

// ─── Viewport fitting ────────────────────────────────────────────────────────

/**
 * Computes the pan and zoom that centre a set of nodes in the viewport.
 *
 * Shared by {@link module:hooks/useAutoFit}, which fits the whole graph once it
 * is laid out, and by the guided tour, which fits the handful of elements the
 * section on screen is talking about.
 *
 * @param {PositionMap} positions - World-space positions keyed by element ID.
 * @param {string[]|null} ids     - Subset to fit; null or omitted fits everything.
 * @param {{ w: number, h: number }} dims - Container pixel dimensions.
 * @param {Object} [options]
 * @param {number} [options.padding=96] - Total px subtracted per axis before fitting.
 *   Never more than half an axis, however large it is asked to be — see below.
 * @param {number} [options.maxZoom=1]  - Upper zoom bound.
 * @param {number} [options.minZoom=0.2] - Lower zoom bound, matching `usePan`'s
 *   own floor: `resetView` takes whatever it is handed without clamping it.
 * @returns {{ pan: { x: number, y: number }, zoom: number } | null} Null when
 *   nothing to fit, or the container has no size yet.
 */
export function fitView(
  positions,
  ids,
  dims,
  { padding = 96, maxZoom = 1, minZoom = 0.2 } = {},
) {
  if (!positions) return null;
  const keys = ids ?? Object.keys(positions);
  const pts = keys.map((id) => positions[id]).filter(Boolean);
  if (!pts.length || !dims?.w || !dims?.h) return null;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // `|| 1`: a single node has no extent, so the ratio below would be Infinity
  // and the zoom would land on maxZoom anyway — this just keeps it finite.
  const boxW = maxX - minX || 1;
  const boxH = maxY - minY || 1;

  // Padding is in screen pixels and is chosen for a canvas the size of a
  // window. The phone's graph strip under the tour's sheet is a couple of
  // hundred pixels tall, which a 200px margin eats whole: `extent - padding`
  // came out at zero — nothing visible — or below it, and a negative zoom
  // flips the graph and blows it up to several times the viewport. So margins
  // never take more than half an axis, and the zoom is floored as well.
  const usable = (extent) => Math.max(extent - padding, extent / 2);

  const zoom = Math.max(
    Math.min(usable(dims.w) / boxW, usable(dims.h) / boxH, maxZoom),
    minZoom,
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    pan: { x: dims.w / 2 - cx * zoom, y: dims.h / 2 - cy * zoom },
    zoom,
  };
}

/**
 * How the guided tour frames the handful of elements a section names.
 *
 * Both numbers follow the *shorter* axis of the canvas, because both were
 * chosen for one the size of a desktop window and neither survives the phone's
 * graph strip — a couple of hundred pixels of it, once the tour's sheet has the
 * bottom of the screen. A fixed 200px margin is that whole strip, and a 1.5×
 * cap on a section naming a single node fills it with one circle at a
 * magnification the reader has no way to read as "this is one node".
 *
 * So the cap reaches 1.5 only on a canvas with 600px to give on both axes, and
 * a phone gets 1× — where a judgment is around a third of the strip's height,
 * which is what "zoomed to this element" should look like.
 *
 * @param {{ w: number, h: number }} dims - Container pixel dimensions.
 * @returns {{ padding: number, maxZoom: number }} For {@link fitView}.
 */
export function focusFraming(dims) {
  const short = Math.min(dims?.w || 0, dims?.h || 0);
  return {
    padding: Math.min(200, short * 0.35),
    maxZoom: Math.max(1, Math.min(1.5, short / 400)),
  };
}

// ─── Joint argument geometry ─────────────────────────────────────────────────

/**
 * Computes the junction point for a joint argument visualization.
 * The junction sits on the conclusion→centroid axis at half the distance,
 * but no closer than (conclusionRadius + 18) px so the arrowhead always fits.
 *
 * @param {number}   centX        - Premise centroid x.
 * @param {number}   centY        - Premise centroid y.
 * @param {Position} conclusionPos - Conclusion node centre.
 * @param {number}   tr           - Conclusion node radius, or its
 *   {@link boundaryDistance} towards the premises' centroid.
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
 * @param {number} px - Test point x.
 * @param {number} py - Test point y.
 * @param {number} x0 - Curve start x.
 * @param {number} y0 - Curve start y.
 * @param {number} cx - Control point x.
 * @param {number} cy - Control point y.
 * @param {number} x1 - Curve end x.
 * @param {number} y1 - Curve end y.
 * @param {number} [samples=16] - Number of points sampled along the curve.
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
