/**
 * @fileoverview Click and hit-test logic for the main force-directed graph.
 * @module hooks/useGraphClick
 */

import { useRef } from "react";
import { hitsElement, relationAt } from "../utils/graphHelpers.js";

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

  /** The relation under a point, if any: see `relationAt` in graphHelpers. */
  const relationAtPoint = (sx, sy) =>
    relationAt(
      { relations: visRels, jointGroups, positions, elementById, edgeOffsets },
      sx,
      sy,
    );

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
      onTap?.(el ?? null, el ? null : relationAtPoint(sx, sy));
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
    const hit = relationAtPoint(sx, sy);
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

  return { onPointerDown, onPointerUp, nodeAt, relationAt: relationAtPoint, toSim };
}
