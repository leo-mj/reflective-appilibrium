/**
 * @fileoverview An element drawn as a node — or, in the statement view, as the card around one — with the rings and tags drawn on it.
 *
 * One of the drawing components gathered in `GraphElements.jsx`, which both
 * graph tabs import from.
 *
 * @module components/graphs_shared/GraphNode
 */

/** @import { REElement } from '../../types.js' */

import { C, getColors } from "../../constants/colors.js";
import { usePalette } from "../../hooks/useTheme.js";
import { inkWeight } from "../../constants/palettes.js";
import { elementRadius, nodeLabelSize } from "../../utils/graphHelpers.js";
import { NodeShape } from "./NodeShape.jsx";
import { StatementCard } from "./StatementCard.jsx";

/**
 * SVG SMIL pulse ring shown on newly-added elements in the History tab.
 * Shape varies by element type: rounded rect for principles, circle otherwise.
 *
 * @param {Object}  props
 * @param {string}  props.type   - Element type (`"principle"` | other).
 * @param {number}  props.radius - Node radius.
 * @param {{ hw: number, hh: number }} [props.card] - A statement card to ring instead.
 */
export function PulseRing({ type, radius, card }) {
  const animation = (
    <animate
      attributeName="opacity"
      values="0.7;0.15;0.7"
      dur="2.5s"
      repeatCount="indefinite"
    />
  );
  if (card) {
    return (
      <rect
        width={2 * card.hw + 10}
        height={2 * card.hh + 10}
        x={-card.hw - 5}
        y={-card.hh - 5}
        rx={13}
        fill="none"
        stroke={C.added}
        strokeWidth={2}
      >
        {animation}
      </rect>
    );
  }
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

/**
 * An outline `pad` px outside a node: a circle, or a box round a statement card.
 *
 * @param {{ element: REElement & { card?: { hw: number, hh: number } }, r: number, pad: number }} props
 *   Any further props are the outline's stroke styling.
 */
export function NodeRing({ element, r, pad, ...stroke }) {
  if (element.card) {
    const { hw, hh } = element.card;
    return (
      <rect
        x={-hw - pad}
        y={-hh - pad}
        width={2 * (hw + pad)}
        height={2 * (hh + pad)}
        rx={8 + pad}
        fill="none"
        {...stroke}
      />
    );
  }
  return <circle r={r + pad} fill="none" {...stroke} />;
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
 * @param {number}          props.opacity      - Fades the whole node (dimmed, withdrawn, rejected);
 *                                               on a statement card, only a selection's dimming.
 * @param {number}          [props.fade]       - A statement card's withdrawn or rejected state,
 *                                               which it applies to its badge and outline.
 * @param {string}          [props.transition]
 * @param {string}          [props.cursor]
 * @param {Function}        [props.onMouseEnter]
 * @param {Function}        [props.onMouseLeave]
 * @param {string}          [props.processTag] - Which merged process(es) it came from, e.g. `"A+B"`.
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
  processTag,
  fade = 1,
  search = "",
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
  const struck = isWithdrawn || isRejected;
  const { card } = element;
  return (
    <g
      transform={`translate(${position.x},${position.y})`}
      style={{ opacity, transition, cursor }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {card ? (
        <StatementCard card={card} stroke={stroke} fade={fade} search={search}>
          <NodeBadge
            element={element}
            radius={radius}
            fill={fill}
            stroke={stroke}
            struck={struck}
          />
        </StatementCard>
      ) : (
        <NodeBadge
          element={element}
          radius={radius}
          fill={fill}
          stroke={stroke}
          struck={struck}
        />
      )}
      {processTag && (
        <ProcessTag
          label={processTag}
          radius={radius}
          at={card && { x: card.hw - 10, y: -card.hh }}
        />
      )}
    </g>
  );
}

/** A node's shape with its id inside — the whole node, or a card's badge. */
function NodeBadge({ element, radius, fill, stroke, struck }) {
  const palette = usePalette();
  return (
    <>
      <NodeShape e={element} r={radius} fill={fill} stroke={stroke} op={1} />
      <text
        textAnchor="middle"
        dy="0.35em"
        // One ink for every node — varying it per node reads as noise. Which
        // ink, and therefore which weight, belongs to the palette: white glyphs
        // need the weight to hold together at this size, black ones go blobby
        // with it. See constants/palettes.js.
        fill={palette.ink}
        fontSize={nodeLabelSize(element.type)}
        fontWeight={inkWeight(palette.ink)}
        style={{
          textDecoration: struck ? "line-through" : "none",
          pointerEvents: "none",
        }}
      >
        {element.id}
      </text>
    </>
  );
}

/**
 * The letter of the merged process an element came from, pinned to the node's
 * upper right. Letters rather than a colour per process: the node's colour
 * already carries type and confidence, and a letter reads the same in every mode
 * and to every reader. Chrome colours, for the reason groups take them — a
 * process is not an element type. On top of the shape, since the selection ring
 * and pulse that arrive as `children` are drawn behind it.
 *
 * @param {{ label: string, radius: number, at?: { x: number, y: number } }} props
 *   `at` places it elsewhere — on a statement card's top edge.
 */
export function ProcessTag({ label, radius, at }) {
  const h = 13;
  const w = 7 + label.length * 6;
  const { x, y } = at ?? { x: radius * 0.7, y: -radius * 0.95 };
  return (
    <g
      transform={`translate(${x - (at ? w / 2 : 0)},${y})`}
      style={{ pointerEvents: "none" }}
      data-testid="process-tag"
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill={C.panel}
        stroke={C.dim}
        strokeWidth={1}
      />
      <text
        textAnchor="middle"
        dy="0.35em"
        fontSize={9}
        fontWeight="bold"
        fill={C.text}
      >
        {label}
      </text>
    </g>
  );
}
