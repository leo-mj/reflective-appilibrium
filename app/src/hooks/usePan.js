/**
 * @fileoverview React hook that manages SVG pan state via the Pointer Events API.
 *
 * Shared between {@link module:components/Graph} and {@link module:components/HistoryTab}.
 * Both tabs use identical pan mechanics: `setPointerCapture` on pointer-down so
 * dragging remains smooth even when the pointer leaves the SVG boundary.
 *
 * @module hooks/usePan
 */

import { useState, useRef } from "react";

/**
 * Manages pan state for an SVG canvas.
 *
 * Returns the current pan offset, a dragging flag, and three pointer-event
 * handlers to spread onto the SVG element.  The consumer may wrap the returned
 * handlers to add extra behaviour (e.g. click detection in Graph).
 *
 * @returns {{
 *   pan:          { x: number, y: number },
 *   isDragging:   boolean,
 *   onPointerDown: function(React.PointerEvent): void,
 *   onPointerMove: function(React.PointerEvent): void,
 *   onPointerUp:   function(React.PointerEvent): void,
 * }}
 */
export function usePan() {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  /** @param {React.PointerEvent} e */
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX - pan.x, py: e.clientY - pan.y };
    setIsDragging(true);
  };

  /** @param {React.PointerEvent} e */
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.px, y: e.clientY - dragRef.current.py });
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  return { pan, isDragging, onPointerDown, onPointerMove, onPointerUp };
}
