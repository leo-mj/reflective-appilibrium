/**
 * @fileoverview A group, drawn as the dashed box around its members or, collapsed, as one disc.
 *
 * One of the drawing components gathered in `GraphElements.jsx`, which both
 * graph tabs import from.
 *
 * @module components/graphs_shared/GraphGroup
 */

/** @import { REElement } from '../../types.js' */

import { C, TRANSITION } from "../../constants/colors.js";
import { GROUP_LABEL_METRICS, groupLabelLines } from "../../utils/groupUtils.js";

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
