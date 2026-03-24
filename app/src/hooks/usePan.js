/**
 * @fileoverview React hook that manages SVG pan + zoom state via the Pointer Events API.
 *
 * @module hooks/usePan
 */

import { useState, useRef, useCallback } from "react";

/**
 * Manages pan and zoom state for an SVG canvas.
 *
 * Zoom is applied by `GraphCanvas` via a non-passive wheel listener so that
 * `e.preventDefault()` can suppress page scroll.  The hook exposes
 * `applyWheel(deltaY, mx, my)` for that listener, plus `zoomIn`/`zoomOut` for
 * button-based zooming.
 *
 * @returns {{
 *   pan:          { x: number, y: number },
 *   zoom:         number,
 *   isDragging:   boolean,
 *   onPointerDown: function(React.PointerEvent): void,
 *   onPointerMove: function(React.PointerEvent): void,
 *   onPointerUp:   function(React.PointerEvent): void,
 *   applyWheel:   function(deltaY: number, mx: number, my: number): void,
 *   zoomIn:       function(): void,
 *   zoomOut:      function(): void,
 * }}
 */
export function usePan() {
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Refs so wheel/zoom callbacks always see the latest values without stale closures.
  const panRef  = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const dragRef = useRef(null);

  const _setPan  = (p) => { panRef.current  = p; setPan(p); };
  const _setZoom = (z) => { zoomRef.current = z; setZoom(z); };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX - panRef.current.x, py: e.clientY - panRef.current.y };
    setIsDragging(true);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    _setPan({ x: e.clientX - dragRef.current.px, y: e.clientY - dragRef.current.py });
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  /** Called by GraphCanvas's non-passive wheel listener. `mx`/`my` are SVG-relative px. */
  const applyWheel = useCallback((deltaY, mx, my) => {
    const factor  = deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.max(0.2, Math.min(4, zoomRef.current * factor));
    const scale   = newZoom / zoomRef.current;
    const newPan  = {
      x: mx - (mx - panRef.current.x) * scale,
      y: my - (my - panRef.current.y) * scale,
    };
    _setPan(newPan);
    _setZoom(newZoom);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomIn  = () => _setZoom(Math.min(4,   zoomRef.current * 1.25));
  const zoomOut = () => _setZoom(Math.max(0.2,  zoomRef.current / 1.25));

  /** Snap the view to an exact pan + zoom, e.g. for auto-fit. */
  const resetView = useCallback((newPan, newZoom = 1) => {
    _setPan(newPan);
    _setZoom(newZoom);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { pan, zoom, isDragging, onPointerDown, onPointerMove, onPointerUp, applyWheel, zoomIn, zoomOut, resetView };
}
