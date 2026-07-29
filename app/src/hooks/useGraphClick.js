/**
 * @fileoverview Click and hit-test logic for the main force-directed graph.
 * @module hooks/useGraphClick
 */

import { useRef } from "react";
import {
  hitRadius,
  nodeRadius,
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
}) {
  const clickOrigin = useRef(null);

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

    // Convert screen → simulation coordinates (accounting for pan and zoom).
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = (e.clientX - rect.left - pan.x) / zoom;
    const sy = (e.clientY - rect.top - pan.y) / zoom;

    if (pointerType === "touch") {
      // Touch: tap shows/dismisses tooltip only — no focus/selection.
      for (const el of visibleEls) {
        const pos = positions[el.id];
        if (!pos) continue;
        if ((pos.x - sx) ** 2 + (pos.y - sy) ** 2 < hitRadius(el.type, el.confidence) ** 2) {
          setTooltip((prev) =>
            prev?.el?.id === el.id
              ? null
              : { x: e.clientX, y: e.clientY - 10, el },
          );
          return;
        }
      }
      // Tapped background — clear tooltip.
      setTooltip(null);
      return;
    }

    // Mouse: node hit-test → focus/selection.
    for (const el of visibleEls) {
      const pos = positions[el.id];
      if (!pos) continue;
      if ((pos.x - sx) ** 2 + (pos.y - sy) ** 2 < hitRadius(el.type, el.confidence) ** 2) {
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
    }

    // Edge hit-test (threshold 8 px) — uses the same bezier geometry as rendering.
    for (const r of visRels) {
      const sp = positions[r.from], tp = positions[r.to];
      if (!sp || !tp) continue;
      const srcEl = elementById.get(r.from);
      const tgtEl = elementById.get(r.to);
      const { x1, y1, tipX, tipY, perpX, perpY } = arrowGeometry(
        sp, tp,
        nodeRadius(srcEl?.type, srcEl?.confidence),
        nodeRadius(tgtEl?.type, tgtEl?.confidence),
      );
      const offset = edgeOffsets.get(r) ?? 0;
      const cx = (x1 + tipX) / 2 + perpX * offset;
      const cy = (y1 + tipY) / 2 + perpY * offset;
      const tdx = tipX - cx, tdy = tipY - cy;
      const tlen = Math.hypot(tdx, tdy) || 1;
      const bx = tipX - (tdx / tlen) * 10, by = tipY - (tdy / tlen) * 10;
      if (distToQuadBezier(sx, sy, x1, y1, cx, cy, bx, by) < 8) {
        onNodeClick?.(null);
        onSelect(() => null);
        onSelectRel((prev) => (prev === r ? null : r));
        return;
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
      const tr = nodeRadius(conclusionEl.type, conclusionEl.confidence);
      const { jx, jy } = computeJunction(centX, centY, conclusionPos, tr);
      // Junction circle
      if (Math.hypot(sx - jx, sy - jy) < 10) {
        onNodeClick?.(null);
        onSelect(() => null);
        onSelectRel((prev) => (prev === rels[0] ? null : rels[0]));
        return;
      }
      // Premise lines
      for (const { r, el, pos } of premises) {
        const sr = nodeRadius(el.type, el.confidence);
        const dx = jx - pos.x, dy = jy - pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        const x1 = pos.x + (dx / dist) * sr, y1 = pos.y + (dy / dist) * sr;
        if (distToSegment(sx, sy, x1, y1, jx, jy) < 8) {
          onNodeClick?.(null);
          onSelect(() => null);
          onSelectRel((prev) => (prev === r ? null : r));
          return;
        }
      }
      // Conclusion arrow
      const adx = conclusionPos.x - jx, ady = conclusionPos.y - jy;
      const adist = Math.hypot(adx, ady) || 1;
      const tipX = conclusionPos.x - (adx / adist) * tr;
      const tipY = conclusionPos.y - (ady / adist) * tr;
      if (distToSegment(sx, sy, jx, jy, tipX, tipY) < 8) {
        onNodeClick?.(null);
        onSelect(() => null);
        onSelectRel((prev) => (prev === rels[0] ? null : rels[0]));
        return;
      }
    }

    // Clicked background — clear selection and any pinned tooltip.
    onNodeClick?.(null);
    onSelect(() => null);
    onSelectRel(() => null);
  };

  return { onPointerDown, onPointerUp };
}
