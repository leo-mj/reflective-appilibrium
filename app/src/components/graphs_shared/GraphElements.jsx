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
  boundaryDistance,
  elementRadius,
  nodeLabelSize,
  RELATION_LABELS,
  edgeDashArray,
  arrowGeometry,
} from "../../utils/graphHelpers.js";
import {
  GROUP_LABEL_METRICS,
  groupLabelLines,
} from "../../utils/groupUtils.js";
import { STATEMENT_CARD } from "../../utils/statementCards.js";
import { textMeasurer } from "../../utils/textWidth.js";
import { wrapWords } from "../../utils/wrapWords.js";
import { NodeShape } from "./NodeShape.jsx";
import { NodeTooltip } from "./NodeTooltip.jsx";
import { Tooltip } from "../Tooltip.jsx";
import { StatementCardIcon } from "../Icons.jsx";

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

// ─── PulseRing ────────────────────────────────────────────────────────────────

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

// ─── GraphNode ────────────────────────────────────────────────────────────────

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
 * An element as the statement view draws it: a box outlined in the node's own
 * colour, the node itself as a badge at its left, the wording beside it. The
 * geometry is `statementCard` in `utils/statementCards.js`, which edges and the
 * layout read too. The node's opacity, inherited from the group it sits in, is
 * what a selection elsewhere dims it by.
 *
 * A withdrawn or rejected card (`fade` below 1) fades its badge and outline,
 * which keep the state's grey or rose and the struck-through id — striking
 * four lines of wording too would only make them harder to read — and writes
 * its wording in the secondary text colour at full strength: out of play, and
 * still readable. Its background stays opaque, so nothing shows through the
 * text either.
 *
 * @param {{ card: import('../../utils/statementCards.js').StatementCard,
 *   stroke: string, fade?: number, children: React.ReactNode }} props
 */
function StatementCard({ card, stroke, fade = 1, search = "", children }) {
  const { fontSize, lineHeight } = STATEMENT_CARD;
  return (
    <g
      data-testid={card.expanded ? "statement-card-expanded" : "statement-card"}
    >
      {/* Outline only: the fill is `CardBackground`, drawn under the edges —
          except on an expanded card, which lies over everything, edges and
          neighbouring cards included, and has to cover them. */}
      <rect
        x={-card.hw}
        y={-card.hh}
        width={2 * card.hw}
        height={2 * card.hh}
        rx={8}
        fill={card.expanded ? C.panel : "none"}
        stroke={stroke}
        // The stroke only: on a grown card this rect is the fill as well.
        strokeOpacity={fade}
        // Heavier under the pointer, grown or not — see `hovered` in `Graph`.
        strokeWidth={card.hovered ? 2.5 : 1.5}
        // The whole box is the hover target, fill or no fill. SVG hit-tests an
        // unfilled shape on its stroke alone, and the text takes no pointer
        // events, so without this only the border and the badge reacted — and
        // most hovers, landing on the wording, grew nothing.
        pointerEvents="all"
      />
      <g
        transform={`translate(${card.badgeX},${card.badgeY ?? 0})`}
        opacity={fade}
      >
        {children}
      </g>
      <text
        fontSize={fontSize}
        fill={fade < 1 ? C.dim : C.text}
        // A halo in the card's own colour: an edge crossing the card shows up
        // to the letters and stops short of cutting through them.
        stroke={C.panel}
        strokeWidth={4}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ pointerEvents: "none" }}
      >
        {card.lines.map((line, i) => (
          <tspan key={i} x={card.textX} y={card.textY + i * lineHeight}>
            <SearchMarks text={line} query={search} />
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** Metrics for the box an edge's explanation shows in, in screen px. */
const RELATION_LABEL = {
  fontSize: 12,
  lineHeight: 15,
  maxWidth: 240,
  maxLines: 6,
  padX: 8,
  padY: 6,
  /** Between the anchor on the edge and the box's bottom edge. */
  lift: 12,
  /** For the estimate where nothing can measure; see `utils/textWidth.js`. */
  charWidth: 0.6,
};

/**
 * What an edge says, shown while the pointer is on it (or after a tap): its
 * type, and the explanation given for it — which the graph otherwise never
 * shows, and which is most of what there is to read about a relation. A joint
 * argument shows each distinct explanation its premises carry.
 *
 * Held at one size on screen whatever the zoom, by scaling against it: a box
 * zoomed out with the graph would be unreadable exactly when the graph is
 * too small to follow without it. Outlined in the edge's colour, so it says
 * which edge it belongs to; written in the text colours, since relation
 * colours are not all legible as type (see `palette.edges`).
 *
 * @param {{ hit: { rel: object, rels: object[], x: number, y: number },
 *   zoom: number, color: string, fontFamily: string }} props
 */
export function RelationLabel({ hit, zoom, color, fontFamily }) {
  const { fontSize, lineHeight, maxWidth, maxLines, padX, padY, lift, charWidth } =
    RELATION_LABEL;
  const estimate = (s) => s.length * fontSize * charWidth;
  const measure = textMeasurer(`${fontSize}px ${fontFamily}`) ?? estimate;
  const measureBold = textMeasurer(`600 ${fontSize}px ${fontFamily}`) ?? estimate;

  const heading = RELATION_LABELS[hit.rel.type] ?? hit.rel.type;
  const explanations = [
    ...new Set(hit.rels.map((r) => r.explanation?.trim()).filter(Boolean)),
  ];
  const lines = explanations.flatMap((t) =>
    wrapWords(t, maxWidth, maxLines, measure),
  );
  const w =
    Math.max(measureBold(heading), ...lines.map(measure), 0) + 2 * padX;
  const h = (1 + lines.length) * lineHeight + 2 * padY;
  return (
    <g
      transform={`translate(${hit.x},${hit.y}) scale(${1 / zoom})`}
      style={{ pointerEvents: "none" }}
      data-testid="relation-label"
    >
      <rect
        x={-w / 2}
        y={-h - lift}
        width={w}
        height={h}
        rx={6}
        fill={C.panel}
        stroke={color}
        strokeWidth={1.5}
      />
      <text fontSize={fontSize} fill={C.text}>
        <tspan
          x={-w / 2 + padX}
          y={-h - lift + padY + fontSize}
          fontWeight={600}
        >
          {heading}
        </tspan>
        {lines.map((line, i) => (
          <tspan
            key={i}
            x={-w / 2 + padX}
            y={-h - lift + padY + fontSize + (i + 1) * lineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/**
 * A line of card text with what the text panel's search found in it marked —
 * the SVG counterpart of the panel's `Highlight`. Underlined and in the teal
 * foreground tone the panel's mark is tinted with, not bolded: a card is sized
 * to its text's measured width, and bold runs wider.
 *
 * @param {{ text: string, query: string }} props
 */
function SearchMarks({ text, query }) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <tspan
        key={i}
        data-testid="search-mark"
        fill={C.supportsText}
        textDecoration="underline"
      >
        {part}
      </tspan>
    ) : (
      part
    ),
  );
}

/**
 * A statement card's fill, drawn in a layer of its own *under* the edges, with
 * the card's outline and contents over them.
 *
 * An opaque card over the edges hid every edge that ran behind it, and there
 * was no way to tell where one went; a translucent one only half-hid them.
 * This way an edge crossing a card is drawn in full up to the text, whose halo
 * keeps it legible, and the card still reads as a card because its background
 * separates it from the canvas.
 *
 * @param {{ card: import('../../utils/statementCards.js').StatementCard,
 *   position: { x: number, y: number }, opacity: number, transition?: string }} props
 *   `opacity` is the node's, so a card a selection dims fades as a whole. A
 *   withdrawn one does not: its background stays opaque behind its wording.
 */
export function CardBackground({ card, position, opacity, transition }) {
  return (
    <rect
      x={position.x - card.hw}
      y={position.y - card.hh}
      width={2 * card.hw}
      height={2 * card.hh}
      rx={8}
      fill={C.panel}
      style={{ opacity, transition, pointerEvents: "none" }}
    />
  );
}

/**
 * Every card's fill, for a canvas's worth of elements — the layer the edges are
 * drawn over. Shared by the Graph and History tabs, which differ only in how a
 * card fades (`visualsOf`: the selection's dimming on one, the playback's on
 * the other).
 *
 * A grown card is left out: it fills itself, lying over its neighbours as
 * well as over the edges.
 *
 * @param {{ elements: REElement[], positions: Object,
 *   visualsOf: function(REElement): { opacity: number, transition?: string } }} props
 */
export function CardBackgrounds({ elements, positions, visualsOf }) {
  return elements.map((el) => {
    const position = positions[el.id];
    if (!el.card || el.card.expanded || !position) return null;
    const { opacity, transition } = visualsOf(el);
    return (
      <CardBackground
        key={el.id}
        card={el.card}
        position={position}
        opacity={opacity}
        transition={transition}
      />
    );
  });
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
 * Switches the graph's statement view on and off — see `hooks/useStatementView.js`.
 * One of the canvas's own controls rather than a ☰ setting, being a way of
 * reading this canvas and nothing else: the text panel, the other graph tabs
 * and the export do not follow it.
 *
 * @param {{ on: boolean, onToggle: function(): void }} props
 */
export function StatementToggle({ on, onToggle }) {
  return (
    <Tooltip text={on ? "Hide element text" : "Show element text"}>
      <button
        style={{
          ...ZOOM_BTN,
          ...(on && { color: C.text, borderColor: C.text }),
        }}
        onClick={onToggle}
        aria-label="Show element text"
        aria-pressed={on}
        // Ringed by the tour's section on the statement view.
        data-tutorial="statement-toggle"
      >
        <StatementCardIcon size={22} />
      </button>
    </Tooltip>
  );
}

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
 * @param {Function}            [props.onPointerLeave]
 * @param {Function}            [props.applyWheel]   - Non-passive wheel handler for zoom.
 * @param {Function}            [props.zoomIn]
 * @param {Function}            [props.zoomOut]
 * @param {React.ReactNode}     [props.viewControls] - Drawn above the zoom buttons.
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
  onPointerLeave,
  applyWheel,
  zoomIn,
  zoomOut,
  viewControls,
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
            // A drag is a pan, and nothing drawn here is text to copy: without
            // this, panning across the canvas selects every label it passes.
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
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
          {viewControls}
          <Tooltip text="Zoom in">
            <button style={ZOOM_BTN} onClick={zoomIn} aria-label="Zoom in">
              +
            </button>
          </Tooltip>
          <Tooltip text="Zoom out">
            <button style={ZOOM_BTN} onClick={zoomOut} aria-label="Zoom out">
              −
            </button>
          </Tooltip>
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
    // A statement card is wider than tall; anything else is a radius both ways.
    const rx = (el.card?.hw ?? elementRadius(el)) * zoom;
    const ry = (el.card?.hh ?? elementRadius(el)) * zoom;
    const sx = pos.x * zoom + pan.x;
    const sy = pos.y * zoom + pan.y;
    if (sx - rx < 0) hidden.left = true;
    if (sx + rx > dims.w) hidden.right = true;
    if (sy - ry < 0) hidden.top = true;
    if (sy + ry > dims.h) hidden.bottom = true;
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
