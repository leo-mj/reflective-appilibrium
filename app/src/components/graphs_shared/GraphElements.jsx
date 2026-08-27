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
import { C, TRANSITION, getColors } from "../../constants/colors.js";
import { usePalette } from "../../hooks/useTheme.js";
import { inkWeight } from "../../constants/palettes.js";
import {
  elementRadius,
  edgeDashArray,
  arrowGeometry,
} from "../../utils/graphHelpers.js";
import {
  GROUP_LABEL_METRICS,
  groupLabelLines,
} from "../../utils/groupUtils.js";
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
  // Edge colours come from the palette, not from colors.js: high-contrast mode
  // carries its own set. Withdrawn and rejected stay flat — those are states,
  // not relation types, and read the same in either mode.
  const palette = usePalette();
  const color = isRejected
    ? C.rejected
    : isWithdrawn
      ? C.withdrawn
      : palette.edges[relation.type];
  const { x1, y1, tipX, tipY, perpX, perpY } = arrowGeometry(
    sourcePos,
    targetPos,
    elementRadius(sourceEl),
    elementRadius(targetEl),
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
  const radius = elementRadius(element);
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

// ─── Groups ───────────────────────────────────────────────────────────────────

/**
 * The colours a group is drawn in.
 *
 * Deliberately chrome rather than palette: a group is not a fourth element
 * type, and giving it a fill from `constants/palettes.js` would say it was one
 * — as well as making it change colour with the viewing mode for no reason,
 * since the thing it stands for has neither a type nor a confidence. Panel over
 * canvas with a `C.dim` outline is the app's own "this is a container" pairing,
 * and `C.text` on `C.panel` is the one label contrast the design system already
 * guarantees on both grounds.
 */
const GROUP_INK = { fill: C.panel, stroke: C.dim, label: C.text };


/**
 * The dashed box drawn around an expanded group.
 *
 * Behind everything — it is a backdrop, and an outline crossing the edges it
 * contains would read as a relation.
 *
 * @param {Object} props
 * @param {{ x: number, y: number, w: number, h: number }} props.box - Simulation coordinates.
 * @param {string} props.label
 * @param {boolean} [props.dimmed] - True while a selection elsewhere holds the graph.
 */
export function GroupHull({ box, label, dimmed = false }) {
  return (
    <g opacity={dimmed ? 0.25 : 1} style={{ transition: TRANSITION }}>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={18}
        fill={GROUP_INK.stroke}
        fillOpacity={0.06}
        stroke={GROUP_INK.stroke}
        strokeWidth={1.5}
        strokeDasharray="7 5"
      />
      <text
        x={box.x + 14}
        y={box.y + 18}
        fontSize={12}
        fill={GROUP_INK.stroke}
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * A collapsed group, drawn as one node.
 *
 * A disc rather than the rounded box the expanded hull uses, because that is
 * what keeps every piece of geometry around it honest: edges, hit-testing and
 * the off-screen indicators all treat a node as a circle of some radius, and a
 * wide box would have arrowheads landing well short of it on one axis and
 * inside it on the other.
 *
 * One outline, lighter than an element's. It used to be two concentric rings —
 * meant to say "container", but a ring set just inside another is the shape the
 * *selected* node's ring already has, so every collapsed group looked picked.
 *
 * @param {Object} props
 * @param {REElement} props.element - The group pseudo-node from `projectGroups`.
 * @param {Object} props.position
 * @param {number} props.radius
 * @param {number} props.opacity
 * @param {string} [props.transition]
 * @param {string} [props.cursor]
 * @param {Function} [props.onMouseEnter]
 * @param {Function} [props.onMouseLeave]
 * @param {React.ReactNode} [props.children]
 */
export function GraphGroupNode({
  element,
  position,
  radius,
  opacity,
  transition,
  cursor,
  onMouseEnter,
  onMouseLeave,
  children,
}) {
  const count = element.memberIds?.length ?? 0;
  const lines = groupLabelLines(element.label);
  const { fontSize, lineHeight, countLineHeight } = GROUP_LABEL_METRICS;
  // The name and the count together are centred on the disc: `y` is a baseline,
  // so the first one sits half the block above the middle, plus the cap height.
  const blockHeight = lines.length * lineHeight + countLineHeight;
  const textTop = -blockHeight / 2 + fontSize;
  return (
    <g
      transform={`translate(${position.x},${position.y})`}
      style={{ opacity, transition, cursor }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      <circle
        r={radius}
        fill={GROUP_INK.fill}
        stroke={GROUP_INK.stroke}
        strokeWidth={1.5}
      />
      {/* The name, inside. It is the only thing that tells two collapsed groups
          apart, so it goes where the eye already is rather than hanging under
          the disc — `groupRadius` sizes the disc around it. */}
      {lines.map((line, i) => (
        <text
          key={i}
          textAnchor="middle"
          y={textTop + i * lineHeight}
          fontSize={fontSize}
          fontWeight="bold"
          fill={GROUP_INK.label}
          style={{ pointerEvents: "none" }}
        >
          {line}
        </text>
      ))}
      <text
        textAnchor="middle"
        y={textTop + lines.length * lineHeight + 2}
        fontSize={9}
        fill={C.dim}
        style={{ pointerEvents: "none" }}
      >
        {count} {count === 1 ? "element" : "elements"}
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
    const r = elementRadius(el) * zoom;
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
