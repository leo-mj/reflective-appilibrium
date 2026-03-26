/**
 * @fileoverview SVG shape renderer for a single RE graph node.
 * @module components/NodeShape
 */

/** @import { REElement } from '../../types.js' */

/**
 * Renders the correct SVG primitive for an element's type, centred on the
 * current SVG coordinate origin (i.e. wrap this in a `<g transform="translate(x,y)">`).
 *
 * | Element type | Shape          | Notes                              |
 * |--------------|----------------|------------------------------------|
 * | `judgment`   | `<circle>`     | radius = `r`                       |
 * | `principle`  | `<rect>`       | width = `r×2.2`, height = `r×1.5`, rounded corners |
 * | `theory`     | `<polygon>`    | axis-aligned diamond, tip-to-tip = `r×2` |
 *
 * All shapes accept the same `fill`, `stroke`, and `op` (opacity) props so
 * callers don't need to branch on type when applying colours.
 *
 * @param {Object}    props
 * @param {REElement} props.e      - The element being rendered (only `type` is read here).
 * @param {number}    props.r      - Base radius / half-size in SVG pixels. Typical values:
 *                                   `28` for principles, `22` for theories, `18` for judgments.
 * @param {string}    props.fill   - CSS colour for the shape interior.
 * @param {string}    props.stroke - CSS colour for the 2 px border.
 * @param {number}    props.op     - Opacity in the range `[0, 1]`.
 * @returns {React.ReactElement} An SVG shape element (`<circle>`, `<rect>`, or `<polygon>`).
 */
export function NodeShape({ e, r, fill, stroke, op }) {
  if (e.type === "principle") {
    const rw = r * 2.2,
      rh = r * 1.5;
    return (
      <rect
        width={rw}
        height={rh}
        x={-rw / 2}
        y={-rh / 2}
        rx={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        opacity={op}
      />
    );
  }
  if (e.type === "theory") {
    return (
      <polygon
        points={`0,${-r} ${r},0 0,${r} ${-r},0`}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        opacity={op}
      />
    );
  }
  return (
    <circle r={r} fill={fill} stroke={stroke} strokeWidth={2} opacity={op} />
  );
}
