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

/**
 * Whether the window has room for the wide layout — the app's one definition of
 * it, so that a component deciding how to draw itself and `REState` deciding
 * where to put it cannot disagree.
 *
 * Both axes, because the wide layout is two panels side by side *above* an add
 * bar: a short window has no more room for that than a narrow one.
 *
 * A hook rather than a constant so that a resize is a re-render. `REState` is
 * the only caller now — the assist tabs' own add panels used to ask it too, from
 * four components down, and the strip that replaced them is placed by `REState`
 * itself — but it stays exported and stays the definition: a second comparison
 * written out somewhere else is how the layout and what is drawn for it come to
 * disagree.
 *
 * @returns {boolean}
 */
export function useIsWide() {
  const { w, h } = useWindowSize();
  return w > 768 && h > 500;
}
