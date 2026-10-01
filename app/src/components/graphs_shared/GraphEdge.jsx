/**
 * @fileoverview A relation drawn as an edge: a line, or a curve for parallel ones, and its arrowhead.
 *
 * One of the drawing components gathered in `GraphElements.jsx`, which both
 * graph tabs import from.
 *
 * @module components/graphs_shared/GraphEdge
 */

/** @import { REElement, RERelation } from '../../types.js' */

import { C } from "../../constants/colors.js";
import { usePalette } from "../../hooks/useTheme.js";
import { boundaryDistance, edgeDashArray, arrowGeometry } from "../../utils/graphHelpers.js";

/**
 * Renders a directed edge as a line + arrowhead polygon.
 *
 * @param {Object}     props
 * @param {RERelation} props.relation
 * @param {Object}     props.sourcePos    - Source position `{ x, y }`.
 * @param {Object}     props.targetPos    - Target position `{ x, y }`.
 * @param {REElement}  props.sourceEl     - Source element (used for radius).
 * @param {REElement}  props.targetEl     - Target element (used for radius).
 * @param {boolean}    props.isWithdrawn
 * @param {boolean}    [props.isRejected]
 * @param {number}     props.opacity
 * @param {number}     [props.strokeWidth=2]
 * @param {string}     [props.transition]
 * @param {boolean}    [props.hitArea=false] - Render a wide transparent stroke for hit-testing.
 */
export function GraphEdge({
  relation,
  sourcePos,
  targetPos,
  sourceEl,
  targetEl,
  isWithdrawn,
  isRejected = false,
  opacity,
  strokeWidth = 2,
  transition,
  hitArea = false,
  parallelOffset = 0,
}) {
  // Edge colours come from the palette, not from colors.js: high-contrast mode
  // carries its own set. Withdrawn and rejected stay flat — those are states,
  // not relation types, and read the same in either mode.
  const palette = usePalette();
  const color = isRejected
    ? C.rejected
    : isWithdrawn
      ? C.withdrawn
      : palette.edges[relation.type];
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const { x1, y1, tipX, tipY, perpX, perpY } = arrowGeometry(
    sourcePos,
    targetPos,
    boundaryDistance(sourceEl, dx, dy),
    boundaryDistance(targetEl, -dx, -dy),
  );

  // Quadratic bezier: control point at midpoint displaced perpendicularly.
  // For parallelOffset=0 this degenerates to a straight line.
  const cx = (x1 + tipX) / 2 + perpX * parallelOffset;
  const cy = (y1 + tipY) / 2 + perpY * parallelOffset;

  // Arrowhead direction: tangent of the bezier at the tip = (tip - ctrl) normalised.
  const tdx = tipX - cx,
    tdy = tipY - cy;
  const tlen = Math.hypot(tdx, tdy) || 1;
  const tux = tdx / tlen,
    tuy = tdy / tlen;
  const tperpX = -tuy,
    tperpY = tux;
  const bx = tipX - tux * 10,
    by = tipY - tuy * 10; // arrowhead base

  const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${bx} ${by}`;
  const isHollow = relation.type === "entails" || relation.type === "precludes";
  return (
    <g opacity={opacity} style={{ transition }}>
      {hitArea && (
        <path d={pathD} stroke="transparent" strokeWidth={16} fill="none" />
      )}
      <path
        d={pathD}
        stroke={color}
        strokeWidth={isHollow ? strokeWidth + 1 : strokeWidth}
        strokeDasharray={edgeDashArray(relation.type)}
        fill="none"
      />
      {isHollow ? (
        <polygon
          points={`${tipX},${tipY} ${bx + tperpX * 5},${by + tperpY * 5} ${bx - tperpX * 5},${by - tperpY * 5}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
      ) : (
        <polygon
          points={`${tipX},${tipY} ${bx + tperpX * 5},${by + tperpY * 5} ${bx - tperpX * 5},${by - tperpY * 5}`}
          fill={color}
        />
      )}
    </g>
  );
}
