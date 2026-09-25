/**
 * @fileoverview How wide a string is drawn, in CSS px, measured by the browser.
 *
 * For SVG text that has to be sized before it is drawn: a statement card's
 * border is where its edges end, so it cannot wait for the text to be laid out
 * and measured in place. The canvas measures the same font the SVG text will
 * inherit, synchronously and without touching the document.
 *
 * An `OffscreenCanvas` rather than a `<canvas>`: jsdom has no canvas, and asking
 * a `<canvas>` for a context there logs an error on every call, where the
 * missing constructor is a clean signal to fall back to an estimate.
 *
 * @module utils/textWidth
 */

/** @type {OffscreenCanvasRenderingContext2D|null|undefined} */
let context;
/** @type {Map<string, number>} */
const cache = new Map();

function getContext() {
  if (context === undefined) {
    try {
      context =
        typeof OffscreenCanvas === "function"
          ? new OffscreenCanvas(1, 1).getContext("2d")
          : null;
    } catch {
      context = null;
    }
  }
  return context;
}

/**
 * A function measuring strings in `font`, or `null` where nothing can measure.
 *
 * @param {string} font - A CSS `font` shorthand, e.g. `"14px Menlo, monospace"`.
 * @returns {(function(string): number)|null}
 */
export function textMeasurer(font) {
  const ctx = getContext();
  if (!ctx) return null;
  return (text) => {
    const key = `${font}\u0000${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      ctx.font = font;
      width = ctx.measureText(text).width;
      // Every word of every statement, in every font tried: bounded in
      // practice, but not worth letting grow without limit.
      if (cache.size > 20000) cache.clear();
      cache.set(key, width);
    }
    return width;
  };
}

/**
 * The font family the page's text is drawn in — the reader's, from ☰ → Font —
 * as the browser resolved it. SVG text inherits it, which is what makes it the
 * font to measure in. Empty where there is no document.
 *
 * @returns {string}
 */
export function pageFontFamily() {
  return typeof document === "undefined"
    ? ""
    : getComputedStyle(document.body).fontFamily;
}

