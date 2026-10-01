/**
 * @fileoverview A statement card grown to its whole statement under the
 * pointer, or under a finger — shared by the two canvases that draw cards, the
 * Graph tab and the History tab.
 *
 * The card itself grows, not a second one laid over it: `grow` swaps the grown
 * copy in for it, moves it last so it is drawn over its neighbours, and shifts
 * it so it grows from its own top-left corner (`expandedCard`). Out of the
 * layout, so growing one moves no other card. Every hovered card is marked
 * `hovered`, grown or not, for the heavier border that answers the pointer.
 *
 * @module hooks/useCardGrowth
 */

/** @import { REElement, PositionMap } from '../types.js' */

import { useRef, useState } from "react";

import { hitsElement } from "../utils/graphHelpers.js";
import { expandedCard } from "../utils/statementCards.js";

/**
 * @param {Object} args
 * @param {(function(string): number)|null} args.measure - What the cards were
 *   sized with, to size the grown one alike.
 * @param {boolean} args.isDragging - A pan in progress grows nothing.
 */
export function useCardGrowth({ measure, isDragging }) {
  // The card under the pointer, or last tapped on a phone.
  const [hovered, setHovered] = useState(null);
  // What the last real pointer on the canvas was. Pointer events say, and the
  // mouse events a browser emulates after a tap raise none — so after a finger
  // this stays "touch" until a mouse actually moves, and the hover handlers
  // below can tell the emulation from a mouse.
  const lastPointer = useRef("mouse");

  /**
   * The canvas's pointer events pass through here, so it knows which pointer
   * it is dealing with.
   *
   * @param {PointerEvent} e
   */
  const notePointer = (e) => {
    lastPointer.current = e.pointerType;
  };

  /**
   * A tap: grows the card tapped, and a tap elsewhere lets it go. Hover alone
   * left a phone unable to read a cut-short card. Set, not toggled: the
   * emulated hover does arrive sometimes, in no fixed order with the tap, and
   * a toggle it had beaten to the card closed the card again.
   *
   * @param {REElement|null} el
   */
  const tap = (el) => setHovered(el?.card ? el.id : null);

  /**
   * The elements and positions to draw, with the hovered card grown.
   *
   * @param {REElement[]} elements
   * @param {PositionMap} positions
   * @returns {{ elements: REElement[], positions: PositionMap,
   *   overlay: { el: REElement, pos: { x: number, y: number } }|null }}
   *   `overlay` is the grown card, which a hit test has to ask first: a click
   *   on its grown part is a click on it, not on what it covers.
   */
  const grow = (elements, positions) => {
    const el = elements.find((e) => e.id === hovered && e.card);
    if (!el) return { elements, positions, overlay: null };
    const grown = expandedCard(el, el.card, { measure });
    const drawn = {
      ...el,
      card: { ...(grown ? grown.card : el.card), hovered: true },
    };
    const pos = positions[el.id];
    const overlay =
      grown && pos
        ? { el: drawn, pos: { x: pos.x + grown.dx, y: pos.y + grown.dy } }
        : null;
    return {
      elements: [...elements.filter((e) => e.id !== el.id), drawn],
      positions: overlay ? { ...positions, [el.id]: overlay.pos } : positions,
      overlay,
    };
  };

  /**
   * The hover handlers for a card, in place of the hover tooltip's — or
   * `undefined` for anything that is not a card.
   *
   * @param {REElement} el
   */
  const hoverFor = (el) =>
    el.card && {
      // Neither answers after a finger: a tap has already grown the card, and
      // what a browser emulates after one — including a mouse moved back to
      // wherever it last was, well off the card — is not the reader's pointer.
      onMouseEnter: () => {
        if (lastPointer.current === "touch") return;
        if (!isDragging) setHovered(el.id);
      },
      onMouseLeave: (ev) => {
        if (lastPointer.current === "touch") return;
        // Only a leave the pointer made. Growing a card moves it to the end of
        // the drawing, and moving a node under the pointer has the browser
        // report the pointer leaving it — which shrank the card at once: on a
        // phone for good, nothing moving the pointer back, and with a mouse as
        // a flicker. The outline is what is asked, not the node's box: that
        // takes in the selection ring, and a real leave across it has to count.
        const outline = ev.currentTarget
          .querySelector('[data-testid^="statement-card"] > rect')
          ?.getBoundingClientRect();
        if (
          outline &&
          ev.clientX > outline.left &&
          ev.clientX < outline.right &&
          ev.clientY > outline.top &&
          ev.clientY < outline.bottom
        )
          return;
        setHovered((prev) => (prev === el.id ? null : prev));
      },
    };

  return { grow, hoverFor, notePointer, tap };
}

/**
 * The element a point in simulation coordinates lands on — the grown card
 * first, being drawn over everything — for a canvas without `useGraphClick`.
 *
 * @param {REElement[]} elements
 * @param {PositionMap} positions
 * @param {{ el: REElement, pos: { x: number, y: number } }|null} overlay
 * @param {number} x
 * @param {number} y
 * @returns {REElement|null}
 */
export function cardAt(elements, positions, overlay, x, y) {
  if (overlay && hitsElement(overlay.el, overlay.pos, x, y)) return overlay.el;
  return (
    elements.find((e) => positions[e.id] && hitsElement(e, positions[e.id], x, y)) ??
    null
  );
}
