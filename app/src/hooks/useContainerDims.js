/**
 * @fileoverview Hook that measures a DOM element's pixel dimensions using ResizeObserver.
 * @module hooks/useContainerDims
 */

/** @import { Dims } from '../types.js' */

import { useState, useEffect } from "react";

/**
 * Tracks the pixel width and height of the DOM element attached to `ref`,
 * updating whenever the element is resized (e.g. on window resize, panel
 * show/hide, or orientation change on mobile).
 *
 * Internally this uses a {@link ResizeObserver} plus a small `setTimeout`
 * safety net to catch the initial measurement before the observer fires.
 * Falls back to `700 × 400` if the element is not yet mounted or reports
 * zero dimensions.
 *
 * @param {React.RefObject<HTMLElement>} ref - A React ref attached to the element to measure.
 * @returns {Dims} The element's current `{ w, h }` in pixels.
 *
 * @example
 * function GraphPanel() {
 *   const containerRef = useRef();
 *   const { w, h } = useContainerDims(containerRef);
 *   return (
 *     <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
 *       <svg width={w} height={h} />
 *     </div>
 *   );
 * }
 */
export function useContainerDims(ref) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const measure = () => {
      if (ref.current) {
        const { clientWidth, clientHeight } = ref.current;
        setDims({ w: clientWidth || 700, h: clientHeight || 400 });
      }
    };
    measure();
    // Safety timeout: ResizeObserver may not fire synchronously on first mount.
    const timer = setTimeout(measure, 50);
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [ref]);
  return dims;
}
