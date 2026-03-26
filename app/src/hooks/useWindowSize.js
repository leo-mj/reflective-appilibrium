/**
 * @fileoverview Hook that tracks the browser window dimensions.
 * @module hooks/useWindowSize
 */

/** @import { Dims } from '../types.js' */

import { useState, useEffect } from "react";

/**
 * Returns the current `window.innerWidth` and `window.innerHeight`, updating
 * reactively whenever the window is resized.
 *
 * Used in {@link module:components/REState} to compute simulation dimensions so
 * the force layout centres nodes correctly relative to the visible graph panel.
 *
 * @returns {Dims} Current window dimensions `{ w, h }` in pixels.
 *
 * @example
 * function MyComponent() {
 *   const { w, h } = useWindowSize();
 *   return <div>{w} × {h}</div>;
 * }
 */
export function useWindowSize() {
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  useEffect(() => {
    const handler = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return size;
}
