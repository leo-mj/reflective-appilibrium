/**
 * @fileoverview Word wrapping for text drawn in SVG, which does not wrap.
 *
 * A module of its own because both a collapsed group's name
 * (`utils/groupUtils.js`) and a statement card (`utils/statementCards.js`) wrap
 * with it, and the second imports the first by way of `utils/graphHelpers.js`.
 *
 * @module utils/wrapWords
 */

/**
 * Text wrapped on word boundaries where they fall in the right place and
 * mid-word where they do not, the last line ellipsised when words are left over.
 *
 * Widths are in whatever unit `widthOf` measures in — characters by default, or
 * pixels when it measures the rendered text, which is what a proportional font
 * needs to wrap evenly.
 *
 * @param {string} text
 * @param {number} maxWidth - Characters by default; the unit `widthOf` returns.
 * @param {number} maxLines
 * @param {function(string): number} [widthOf]
 * @returns {string[]} Never empty.
 */
export function wrapWords(text, maxWidth, maxLines, widthOf = (s) => s.length) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last != null && widthOf(`${last} ${word}`) <= maxWidth) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      // Out of lines with words left over: the tail is cut below anyway.
      lines[lines.length - 1] = `${last} ${word}`;
    }
  }

  return lines.slice(0, maxLines).map((line, i, all) => {
    if (widthOf(line) <= maxWidth) return line;
    // Only the last line takes the ellipsis: an earlier one that is too long
    // means a single unbreakable word, and marking it would suggest words were
    // dropped there.
    const isLast = i === all.length - 1;
    const withMark = (s) => (isLast ? `${s}…` : s);
    let cut = line;
    while (cut.length > 1 && widthOf(withMark(cut)) > maxWidth)
      cut = cut.slice(0, -1);
    return withMark(cut);
  });
}
