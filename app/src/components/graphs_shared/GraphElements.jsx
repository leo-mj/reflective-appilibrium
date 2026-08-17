/**
 * @fileoverview Shared SVG components used by both Graph and HistoryTab.
 *
 * Only React components are exported from this file so that react-refresh
 * fast-reload works correctly. Non-component helpers (render functions,
 * visual-props factories, tooltip handlers) live in `utils/graphRender.jsx`.
 *
 * @module components/GraphElements
 */

/** @import { REElement, RERelation } from '../../types.js' */

import { useEffect, useRef } from "react";
import { C, getColors } from "../../constants/colors.js";
import { usePalette } from "../../hooks/useTheme.js";
import { inkWeight } from "../../constants/palettes.js";
import {
  nodeRadius,
  edgeDashArray,
  arrowGeometry,
} from "../../utils/graphHelpers.js";
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
  const color = isRejected
    ? C.rejected
    : isWithdrawn
      ? C.withdrawn
      : C[relation.type];
  const { x1, y1, tipX, tipY, perpX, perpY } = arrowGeometry(
    sourcePos,
    targetPos,
    nodeRadius(sourceEl?.type, sourceEl?.confidence),
    nodeRadius(targetEl?.type, targetEl?.confidence),
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
  const animation = (
    <animate
      attributeName="opacity"
      values="0.7;0.15;0.7"
      dur="2.5s"
      repeatCount="indefinite"
    />
  );
  if (type === "principle") {
    return (
      <rect
        width={radius * 2.2 + 8}
        height={radius * 1.5 + 8}
        x={-radius * 1.1 - 4}
        y={-radius * 0.75 - 4}
        rx={10}
        fill="none"
        stroke={C.added}
        strokeWidth={2}
      >
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
 * Type size for a node's id.
 *
 * Capped by the *smallest* node of that type, not the average one: the id sits
 * inside the shape, and the shape shrinks to `RADIUS_MIN` (65%) of its base at
 * zero confidence. The binding case is a three-character id on a judgment
 * circle, where the room at the glyph's own height is
 * `2·√(r² − halfHeight²) = 22px` against a width of ~1.65× the font size — which
 * puts the ceiling at 13. Principles are drawn on a 40px-wide rect and have room
 * to spare; theories are diamonds, tighter per pixel of radius but never more
 * than two characters.
 *
 * Raising these further means raising `RADIUS_MIN` in utils/graphHelpers.js,
 * which costs confidence range. `e2e/palette.spec.js` measures the real glyph
 * boxes and fails if a label outgrows its shape.
 *
 * @param {string} type
 */
function labelSize(type) {
  return type === "principle" ? 16 : 13;
}

/**
 * Renders a graph node: shape, label, and optional overlay children
 * (e.g. a selection ring or a pulse ring).
 *
 * @param {Object}          props
 * @param {REElement}       props.element
 * @param {Object}          props.position      - `{ x, y }`.
 * @param {boolean}         props.isWithdrawn
 * @param {boolean}         [props.isRejected]
 * @param {number}          props.opacity      - Fades the whole node (dimmed, withdrawn, rejected).
 * @param {string}          [props.transition]
 * @param {string}          [props.cursor]
 * @param {Function}        [props.onMouseEnter]
 * @param {Function}        [props.onMouseLeave]
 * @param {React.ReactNode} [props.children]
 */
export function GraphNode({
  element,
  position,
  isWithdrawn,
  isRejected = false,
  opacity,
  transition,
  cursor,
  onMouseEnter,
  onMouseLeave,
  children,
}) {
  const palette = usePalette();
  const { fill, stroke } = getColors(
    isRejected
      ? { ...element, status: "rejected" }
      : isWithdrawn
        ? { ...element, status: "withdrawn" }
        : element,
    palette,
  );
  const radius = nodeRadius(element.type, element.confidence);
  return (
    <g
      transform={`translate(${position.x},${position.y})`}
      style={{ opacity, transition, cursor }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      <NodeShape e={element} r={radius} fill={fill} stroke={stroke} op={1} />
      <text
        textAnchor="middle"
        dy="0.35em"
        // One ink for every node — varying it per node reads as noise. Which
        // ink, and therefore which weight, belongs to the palette: white glyphs
        // need the weight to hold together at this size, black ones go blobby
        // with it. See constants/palettes.js.
        fill={palette.ink}
        fontSize={labelSize(element.type)}
        fontWeight={inkWeight(palette.ink)}
        style={{
          textDecoration: isWithdrawn || isRejected ? "line-through" : "none",
          pointerEvents: "none",
        }}
      >
        {element.id}
      </text>
    </g>
  );
}

// ─── GraphCanvas ──────────────────────────────────────────────────────────────

const ZOOM_BTN = {
  width: 44,
  height: 44,
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  background: C.panel,
  color: C.dim,
  cursor: "pointer",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  padding: 0,
};

/**
 * Shared SVG container used by both Graph and HistoryTab.
 *
 * @param {Object}              props
 * @param {React.Ref}           props.containerRef
 * @param {{ w: number, h: number }} props.dims
 * @param {{ x: number, y: number }} props.pan
 * @param {number}              [props.zoom=1]
 * @param {boolean}             props.isDragging
 * @param {Function}            props.onPointerDown
 * @param {Function}            props.onPointerMove
 * @param {Function}            props.onPointerUp
 * @param {Function}            [props.onPointerCancel]
 * @param {Function}            [props.applyWheel]   - Non-passive wheel handler for zoom.
 * @param {Function}            [props.zoomIn]
 * @param {Function}            [props.zoomOut]
 * @param {Object|null}         props.tooltip
 * @param {React.CSSProperties} [props.containerStyle]
 * @param {React.ReactNode}     [props.overlay]
 * @param {React.ReactNode}     [props.children]
 */
export function GraphCanvas({
  containerRef,
  dims,
  pan,
  zoom = 1,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  applyWheel,
  zoomIn,
  zoomOut,
  tooltip,
  tooltipActions,
  containerStyle,
  overlay,
  children,
}) {
  const svgRef = useRef(null);

  // Non-passive wheel listener so e.preventDefault() suppresses page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !applyWheel) return;
    const handler = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyWheel(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [applyWheel]);

  return (
    <div ref={containerRef} style={{ position: "relative", ...containerStyle }}>
      {dims.w > 0 && (
        <svg
          ref={svgRef}
          width={dims.w}
          height={dims.h}
          style={{
            background: C.bg,
            borderRadius: 8,
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {children}
          </g>
        </svg>
      )}
      {(zoomIn || zoomOut) && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <button
            style={ZOOM_BTN}
            onClick={zoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            style={ZOOM_BTN}
            onClick={zoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
        </div>
      )}
      <NodeTooltip tooltip={tooltip} actions={tooltipActions} />
      {overlay}
    </div>
  );
}

// ─── OffscreenIndicators ──────────────────────────────────────────────────────

const ARROW = { left: "◀", right: "▶", top: "▲", bottom: "▼" };

/**
 * Renders directional arrow badges at container edges for any nodes whose
 * screen position falls outside the visible area. Place as the `overlay` prop
 * of `GraphCanvas` (or composed alongside other overlays in a fragment).
 *
 * @param {Object}      props
 * @param {REElement[]} props.els       - Elements to check.
 * @param {PositionMap} props.positions - World-space positions keyed by element ID.
 * @param {{ x: number, y: number }} props.pan
 * @param {number}      props.zoom
 * @param {{ w: number, h: number }} props.dims
 * @param {string}      props.color     - Badge accent color.
 */
export function OffscreenIndicators({
  els,
  positions,
  pan,
  zoom,
  dims,
  color,
}) {
  const hidden = { left: false, right: false, top: false, bottom: false };
  els.forEach((el) => {
    const pos = positions[el.id];
    if (!pos) return;
    const r = nodeRadius(el.type, el.confidence) * zoom;
    const sx = pos.x * zoom + pan.x;
    const sy = pos.y * zoom + pan.y;
    if (sx - r < 0) hidden.left = true;
    if (sx + r > dims.w) hidden.right = true;
    if (sy - r < 0) hidden.top = true;
    if (sy + r > dims.h) hidden.bottom = true;
  });

  const sides = Object.keys(hidden).filter((s) => hidden[s]);
  if (!sides.length) return null;

  const badgePos = (side) =>
    ({
      left: { left: 4, top: "50%", transform: "translateY(-50%)" },
      right: { right: 4, top: "50%", transform: "translateY(-50%)" },
      top: { top: 4, left: "50%", transform: "translateX(-50%)" },
      bottom: { bottom: 4, left: "50%", transform: "translateX(-50%)" },
    })[side];

  return (
    <>
      {sides.map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            pointerEvents: "none",
            ...badgePos(side),
            fontSize: 10,
            lineHeight: 1,
            padding: "2px 5px",
            borderRadius: 4,
            background: color + "33",
            border: `1px solid ${color}66`,
            color,
          }}
        >
          {ARROW[side]}
        </div>
      ))}
    </>
  );
}
