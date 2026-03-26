/**
 * @fileoverview React hook that manages SVG pan + zoom state via the Pointer Events API.
 *
 * Supports mouse/stylus drag-to-pan, scroll-wheel zoom, button zoom, and
 * two-finger pinch-to-zoom on touch devices.
 *
 * @module hooks/usePan
 */

import { useState, useRef, useCallback } from "react";

/** Zoom multiplier per scroll tick or button press. */
const ZOOM_STEP = 1.1;
/** Coarser zoom multiplier for the +/− buttons. */
const ZOOM_BTN_STEP = 1.25;
/** Zoom range clamp. */
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;

export function usePan() {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Refs so callbacks always see latest values without stale closures.
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const dragRef = useRef(null); // { px, py } — pan origin offset

  // All active pointers: pointerId → { x, y }
  const activePointersRef = useRef(new Map());
  // Pinch state (touch only): { prevDist, midX, midY } — SVG-relative, updated each move frame
  const pinchRef = useRef(null);

  const _setPan = (p) => {
    panRef.current = p;
    setPan(p);
  };
  const _setZoom = (z) => {
    zoomRef.current = z;
    setZoom(z);
  };

  /** Zoom to `newZoom` keeping the SVG-relative point (mx, my) fixed on screen. */
  const _applyZoomAt = (newZoom, mx, my) => {
    const scale = newZoom / zoomRef.current;
    _setPan({
      x: mx - (mx - panRef.current.x) * scale,
      y: my - (my - panRef.current.y) * scale,
    });
    _setZoom(newZoom);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...activePointersRef.current.values()];

    if (pts.length === 2 && e.pointerType === "touch") {
      // Second touch finger — switch from pan to pinch.
      const [p1, p2] = pts;
      const rect = e.currentTarget.getBoundingClientRect();
      pinchRef.current = {
        prevDist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        midX: (p1.x + p2.x) / 2 - rect.left,
        midY: (p1.y + p2.y) / 2 - rect.top,
      };
      dragRef.current = null;
      setIsDragging(false);
    } else if (pts.length === 1) {
      dragRef.current = {
        px: e.clientX - panRef.current.x,
        py: e.clientY - panRef.current.y,
      };
      setIsDragging(true);
    }
  };

  const onPointerMove = (e) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...activePointersRef.current.values()];

    if (pts.length === 2 && pinchRef.current) {
      // Pinch zoom: apply delta-based zoom at current midpoint.
      const [p1, p2] = pts;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const rect = e.currentTarget.getBoundingClientRect();
      const midX = (p1.x + p2.x) / 2 - rect.left;
      const midY = (p1.y + p2.y) / 2 - rect.top;
      const newZoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoomRef.current * (dist / pinchRef.current.prevDist)),
      );
      _applyZoomAt(newZoom, midX, midY);
      pinchRef.current = { prevDist: dist, midX, midY };
    } else if (pts.length === 1 && dragRef.current) {
      _setPan({
        x: e.clientX - dragRef.current.px,
        y: e.clientY - dragRef.current.py,
      });
    }
  };

  const _endPointer = (e) => {
    activePointersRef.current.delete(e.pointerId);
    const remaining = activePointersRef.current.size;

    if (remaining === 0) {
      pinchRef.current = null;
      dragRef.current = null;
      setIsDragging(false);
    } else if (remaining === 1 && pinchRef.current) {
      // One finger lifted — transition back to single-finger pan.
      pinchRef.current = null;
      const [, pos] = [...activePointersRef.current.entries()][0];
      dragRef.current = {
        px: pos.x - panRef.current.x,
        py: pos.y - panRef.current.y,
      };
      setIsDragging(true);
    }
  };

  const onPointerUp = (e) => _endPointer(e);
  const onPointerCancel = (e) => _endPointer(e);

  /**
   * Called by GraphCanvas's non-passive wheel listener. `mx`/`my` are SVG-relative px.
   * Empty deps intentional: panRef/zoomRef are refs read at call time to avoid
   * stale closures during rapid wheel events.
   */
  const applyWheel = useCallback((deltaY, mx, my) => {
    const factor = deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newZoom = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, zoomRef.current * factor),
    );
    const scale = newZoom / zoomRef.current;
    _setPan({
      x: mx - (mx - panRef.current.x) * scale,
      y: my - (my - panRef.current.y) * scale,
    });
    _setZoom(newZoom);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomIn = () =>
    _setZoom(Math.min(ZOOM_MAX, zoomRef.current * ZOOM_BTN_STEP));
  const zoomOut = () =>
    _setZoom(Math.max(ZOOM_MIN, zoomRef.current / ZOOM_BTN_STEP));

  /**
   * Snaps the view to an exact pan + zoom, e.g. for auto-fit.
   * Empty deps intentional: _setPan/_setZoom are stable ref wrappers.
   */
  const resetView = useCallback((newPan, newZoom = 1) => {
    _setPan(newPan);
    _setZoom(newZoom);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    pan,
    zoom,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    applyWheel,
    zoomIn,
    zoomOut,
    resetView,
  };
}
