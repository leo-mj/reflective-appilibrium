/**
 * @fileoverview Click and hit-test logic for the main force-directed graph.
 * @module hooks/useGraphClick
 */

import { useRef } from "react";
import {
  boundaryDistance,
  hitsElement,
  arrowGeometry,
  distToSegment,
  distToQuadBezier,
  computeJunction,
} from "../utils/graphHelpers.js";

/**
 * Wraps `usePan` with click-vs-drag detection and graph hit-testing.
 * Returns merged pointer handlers plus the pan state from `usePan`.
 */
export function useGraphClick({
  panDown,
  panUp,
  visibleEls,
  visRels,
  jointGroups,
  elementById,
  edgeOffsets,
  positions,
  pan,
  zoom,
  onSelect,
  onSelectRel,
  setTooltip,
  onCtrlNodeClick,
  onNodeClick,
  onHullClick,
  hulls = [],
  toSourceRel = (r) => r,
  overlay = null,
  onTap,
}) {
  const clickOrigin = useRef(null);

  /**
   * The node under a point, if any. `overlay` — the statement view's expanded
   * card, `{ el, pos }` — is asked first: it is drawn over everything, so a
   * click on it is a click on it, not on whatever it happens to cover.
   */
  const nodeAt = (sx, sy) => {
    if (overlay && hitsElement(overlay.el, overlay.pos, sx, sy))
      return overlay.el;
    return visibleEls.find((el) => {
      const pos = positions[el.id];
      return pos && hitsElement(el, pos, sx, sy);
    });
  };

  /**
   * The relation under a point, if any — with the relations it is drawn with
   * (a joint argument's, or itself alone) and where along the drawing to
   * anchor anything said about it: the edge's midpoint, or the junction dot.
   * Uses the geometry the edges are drawn with, threshold 8px.
   *
   * @param {number} sx
   * @param {number} sy
   * @returns {{ rel: object, rels: object[], x: number, y: number }|null} `rel`
   *   is what a click selects: the edge itself, a premise's own line, or an
   *   argument's first relation for its junction and conclusion arrow.
   */
  const relationAt = (sx, sy) => {
    for (const r of visRels) {
      const sp = positions[r.from], tp = positions[r.to];
      if (!sp || !tp) continue;
      const srcEl = elementById.get(r.from);
      const tgtEl = elementById.get(r.to);
      const ddx = tp.x - sp.x, ddy = tp.y - sp.y;
      const { x1, y1, tipX, tipY, perpX, perpY } = arrowGeometry(
        sp, tp,
        boundaryDistance(srcEl, ddx, ddy),
        boundaryDistance(tgtEl, -ddx, -ddy),
      );
      const offset = edgeOffsets.get(r) ?? 0;
      const cx = (x1 + tipX) / 2 + perpX * offset;
      const cy = (y1 + tipY) / 2 + perpY * offset;
      const tdx = tipX - cx, tdy = tipY - cy;
      const tlen = Math.hypot(tdx, tdy) || 1;
      const bx = tipX - (tdx / tlen) * 10, by = tipY - (tdy / tlen) * 10;
      if (distToQuadBezier(sx, sy, x1, y1, cx, cy, bx, by) < 8) {
        // The curve at its middle: ¼, ½, ¼ of its three points.
        return {
          rel: r,
          rels: [r],
          x: 0.25 * x1 + 0.5 * cx + 0.25 * bx,
          y: 0.25 * y1 + 0.5 * cy + 0.25 * by,
        };
      }
    }

    // Joint argument hit-test: premise lines, junction dot, conclusion arrow.
    for (const rels of jointGroups) {
      const conclusionEl = elementById.get(rels[0].to);
      const conclusionPos = positions[rels[0].to];
      if (!conclusionPos || !conclusionEl) continue;
      const premises = rels
        .map((r) => ({ r, el: elementById.get(r.from), pos: positions[r.from] }))
        .filter((d) => d.el && d.pos);
      if (!premises.length) continue;
      const centX = premises.reduce((s, d) => s + d.pos.x, 0) / premises.length;
      const centY = premises.reduce((s, d) => s + d.pos.y, 0) / premises.length;
      const { jx, jy } = computeJunction(
        centX, centY, conclusionPos,
        boundaryDistance(conclusionEl, centX - conclusionPos.x, centY - conclusionPos.y),
      );
      const tr = boundaryDistance(conclusionEl, jx - conclusionPos.x, jy - conclusionPos.y);
      const at = (rel) => ({ rel, rels, x: jx, y: jy });
      // Junction circle
      if (Math.hypot(sx - jx, sy - jy) < 10) return at(rels[0]);
      // Premise lines
      for (const { r, el, pos } of premises) {
        const dx = jx - pos.x, dy = jy - pos.y;
        const sr = boundaryDistance(el, dx, dy);
        const dist = Math.hypot(dx, dy) || 1;
        const x1 = pos.x + (dx / dist) * sr, y1 = pos.y + (dy / dist) * sr;
        if (distToSegment(sx, sy, x1, y1, jx, jy) < 8) return at(r);
      }
      // Conclusion arrow
      const adx = conclusionPos.x - jx, ady = conclusionPos.y - jy;
      const adist = Math.hypot(adx, ady) || 1;
      const tipX = conclusionPos.x - (adx / adist) * tr;
      const tipY = conclusionPos.y - (ady / adist) * tr;
      if (distToSegment(sx, sy, jx, jy, tipX, tipY) < 8) return at(rels[0]);
    }
    return null;
  };

  /**
   * Screen → simulation coordinates, accounting for pan and zoom.
   *
   * @param {React.PointerEvent} e
   */
  const toSim = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      sx: (e.clientX - rect.left - pan.x) / zoom,
      sy: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  /**
   * Selects the relation an edge stands for.
   *
   * Not always the edge itself: one crossing into a collapsed group is drawn
   * against the group node, and what it is drawn from is a copy. Selection is
   * compared by identity all the way out to the text panel, so what gets
   * selected has to be the relation actually held in state.
   */
  const selectRel = (rel) => {
    const source = toSourceRel(rel);
    onSelectRel((prev) => (prev === source ? null : source));
  };

  /** @param {React.PointerEvent} e */
  const onPointerDown = (e) => {
    panDown(e);
    clickOrigin.current = {
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
    };
    // On touch, keep the existing tooltip visible until pointerUp resolves the tap.
    if (e.pointerType !== "touch") setTooltip(null);
  };

  /** @param {React.PointerEvent} e */
  const onPointerUp = (e) => {
    panUp(e);
    if (!clickOrigin.current) return;
    const { x: ox, y: oy, pointerType } = clickOrigin.current;
    clickOrigin.current = null;
    const threshold = pointerType === "touch" ? 10 : 4;
    if (
      Math.abs(e.clientX - ox) > threshold ||
      Math.abs(e.clientY - oy) > threshold
    )
      return; // drag

    const { sx, sy } = toSim(e);

    if (pointerType === "touch") {
      // Touch: tap shows/dismisses tooltip only — no focus/selection.
      const el = nodeAt(sx, sy);
      // What a finger has in place of hover: the statement view grows a card
      // under the pointer, and an edge's explanation shows under it, and a
      // phone has none. Told of every tap, the background's included, which
      // is how either is let go of.
      onTap?.(el ?? null, el ? null : relationAt(sx, sy));
      if (el) {
        setTooltip((prev) =>
          prev?.el?.id === el.id
            ? null
            : { x: e.clientX, y: e.clientY - 10, el },
        );
        return;
      }
      // Tapped background — clear tooltip.
      setTooltip(null);
      return;
    }

    // Mouse: node hit-test → focus/selection.
    const el = nodeAt(sx, sy);
    if (el) {
      if (e.ctrlKey || e.metaKey) {
        onCtrlNodeClick(el.id);
        onNodeClick?.(null);
      } else {
        onSelectRel(() => null);
        onSelect((prev) => (prev === el.id ? null : el.id));
        onNodeClick?.(el, e.clientX, e.clientY);
      }
      return;
    }

    // Edges, then an expanded group's box.
    const hit = relationAt(sx, sy);
    if (hit) {
      onNodeClick?.(null);
      onSelect(() => null);
      selectRel(hit.rel);
      return;
    }

    // Inside an expanded group's box, but on none of its contents. Last of the
    // shape tests on purpose: the box spans everything it holds, so a member
    // node or an edge between two of them has to win over it.
    for (const { group, box } of hulls) {
      if (
        sx >= box.x &&
        sx <= box.x + box.w &&
        sy >= box.y &&
        sy <= box.y + box.h
      ) {
        // No `onSelectRel(null)` first: selecting a node already clears any
        // relation selection, and the two setters share `selected` — clearing
        // the relation blanks it, so the toggle below would then read null and
        // re-select the group it was meant to let go of.
        onHullClick?.(group.id);
        return;
      }
    }

    // Clicked background — clear selection and any pinned tooltip.
    onNodeClick?.(null);
    onSelect(() => null);
    onSelectRel(() => null);
  };

  return { onPointerDown, onPointerUp, nodeAt, relationAt, toSim };
}
