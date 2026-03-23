/**
 * @fileoverview Shared SVG components used by both Graph and HistoryTab.
 *
 * Only React components are exported from this file so that react-refresh
 * fast-reload works correctly. Non-component helpers (render functions,
 * visual-props factories, tooltip handlers) live in `utils/graphRender.jsx`.
 *
 * @module components/GraphElements
 */

/** @import { REElement, RERelation } from '../types.js' */

import { C, getColors } from "../constants/colors.js";
import { nodeRadius, edgeDashArray, arrowGeometry } from "../utils/graphHelpers.js";
import { NodeShape } from "./NodeShape.jsx";
import { NodeTooltip } from "./NodeTooltip.jsx";

// ─── GraphEdge ────────────────────────────────────────────────────────────────

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
 * @param {number}     props.opacity
 * @param {number}     [props.strokeWidth=2]
 * @param {string}     [props.transition]
 * @param {boolean}    [props.hitArea=false] - Render a wide transparent stroke for hit-testing.
 */
export function GraphEdge({ relation, sourcePos, targetPos, sourceEl, targetEl, isWithdrawn, opacity, strokeWidth = 2, transition, hitArea = false }) {
  const color = isWithdrawn ? C.withdrawn : C[relation.type];
  const { x1, y1, x2, y2, tipX, tipY, perpX, perpY } = arrowGeometry(
    sourcePos, targetPos, nodeRadius(sourceEl?.type), nodeRadius(targetEl?.type)
  );
  return (
    <g opacity={opacity} style={{ transition }}>
      {hitArea && (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16} />
      )}
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={edgeDashArray(relation.type)} />
      <polygon
        points={`${tipX},${tipY} ${x2 + perpX * 5},${y2 + perpY * 5} ${x2 - perpX * 5},${y2 - perpY * 5}`}
        fill={color} />
    </g>
  );
}

// ─── PulseRing ────────────────────────────────────────────────────────────────

/**
 * SVG SMIL pulse ring shown on newly-added elements in the History tab.
 * Shape varies by element type: rounded rect for principles, circle otherwise.
 *
 * @param {Object}  props
 * @param {string}  props.type   - Element type (`"principle"` | other).
 * @param {number}  props.radius - Node radius.
 */
export function PulseRing({ type, radius }) {
  const animation = <animate attributeName="opacity" values="0.7;0.15;0.7" dur="2.5s" repeatCount="indefinite" />;
  if (type === "principle") {
    return (
      <rect
        width={radius * 2.2 + 8} height={radius * 1.5 + 8}
        x={-radius * 1.1 - 4}   y={-radius * 0.75 - 4}
        rx={10} fill="none" stroke={C.added} strokeWidth={2}>
        {animation}
      </rect>
    );
  }
  return (
    <circle r={radius + 5} fill="none" stroke={C.added} strokeWidth={2}>
      {animation}
    </circle>
  );
}

// ─── GraphNode ────────────────────────────────────────────────────────────────

/**
 * Renders a graph node: shape, label, and optional overlay children
 * (e.g. a selection ring or a pulse ring).
 *
 * @param {Object}          props
 * @param {REElement}       props.element
 * @param {Object}          props.position      - `{ x, y }`.
 * @param {boolean}         props.isWithdrawn
 * @param {number}          props.opacity
 * @param {string}          [props.transition]
 * @param {string}          [props.cursor]
 * @param {Function}        [props.onMouseEnter]
 * @param {Function}        [props.onMouseLeave]
 * @param {React.ReactNode} [props.children]
 */
export function GraphNode({ element, position, isWithdrawn, opacity, transition, cursor, onMouseEnter, onMouseLeave, children }) {
  const { fill, stroke } = getColors(isWithdrawn ? { ...element, status: "withdrawn" } : element);
  const radius = nodeRadius(element.type);
  return (
    <g transform={`translate(${position.x},${position.y})`}
      style={{ opacity, transition, cursor }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      {children}
      <NodeShape e={element} r={radius} fill={fill} stroke={stroke} op={1} />
      <text textAnchor="middle" dy="0.35em"
        fill={isWithdrawn ? "#666" : "#fff"}
        fontSize={element.type === "principle" ? 13 : 11}
        fontWeight="bold"
        style={{ textDecoration: isWithdrawn ? "line-through" : "none", pointerEvents: "none" }}>
        {element.id}
      </text>
    </g>
  );
}

// ─── GraphCanvas ──────────────────────────────────────────────────────────────

/**
 * Shared SVG container used by both Graph and HistoryTab.
 *
 * @param {Object}              props
 * @param {React.Ref}           props.containerRef
 * @param {{ w: number, h: number }} props.dims
 * @param {{ x: number, y: number }} props.pan
 * @param {boolean}             props.isDragging
 * @param {Function}            props.onPointerDown
 * @param {Function}            props.onPointerMove
 * @param {Function}            props.onPointerUp
 * @param {Object|null}         props.tooltip
 * @param {React.CSSProperties} [props.containerStyle]
 * @param {React.ReactNode}     [props.overlay]
 * @param {React.ReactNode}     [props.children]
 */
export function GraphCanvas({ containerRef, dims, pan, isDragging, onPointerDown, onPointerMove, onPointerUp, tooltip, containerStyle, overlay, children }) {
  return (
    <div ref={containerRef} style={{ position: "relative", ...containerStyle }}>
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h}
          style={{ background: C.bg, borderRadius: 8, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <g transform={`translate(${pan.x},${pan.y})`}>
            {children}
          </g>
        </svg>
      )}
      <NodeTooltip tooltip={tooltip} />
      {overlay}
    </div>
  );
}
