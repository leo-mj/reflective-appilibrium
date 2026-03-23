/**
 * @fileoverview Shared SVG primitives used by both Graph and HistoryTab.
 *
 * Provides:
 * - Low-level SVG components: `GraphEdge`, `GraphNode`, `PulseRing`
 * - Visual-props factories: `historyEdgeVisuals`, `graphEdgeVisuals`,
 *   `historyNodeVisuals`, `graphNodeVisuals`
 * - Shared render functions: `renderEdge`, `renderNode`
 * - Utilities: `resolveEdge`, `makeTooltipHandlers`
 *
 * @module components/GraphElements
 */

/** @import { REElement, RERelation, PositionMap } from '../types.js' */

import { C, confOp, getColors, TRANSITION } from "../constants/colors.js";
import { nodeRadius, edgeDashArray, arrowGeometry } from "../utils/graphHelpers.js";
import { NodeShape } from "./NodeShape.jsx";
import { NodeTooltip } from "./NodeTooltip.jsx";

// ─── Tooltip handler factory ──────────────────────────────────────────────────

/**
 * Returns `onMouseEnter` / `onMouseLeave` handlers that update a tooltip state.
 * The handler is a no-op while the user is dragging.
 *
 * @param {boolean}   isDragging
 * @param {Function}  setTooltip - State setter for `{ x, y, el } | null`.
 * @param {REElement} element
 * @returns {{ onMouseEnter: Function, onMouseLeave: Function }}
 */
export function makeTooltipHandlers(isDragging, setTooltip, element) {
  return {
    onMouseEnter: (ev) => {
      if (isDragging) return;
      const rect = ev.currentTarget.closest("svg").getBoundingClientRect();
      setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top - 10, el: element });
    },
    onMouseLeave: () => setTooltip(null),
  };
}

// ─── Edge resolution helper ───────────────────────────────────────────────────

/**
 * Resolves positions and element objects for both endpoints of a relation.
 * Returns `null` when either position is missing (element not yet placed).
 *
 * @param {RERelation}  relation
 * @param {PositionMap} positions
 * @param {REElement[]} elements
 * @returns {{ sourcePos: Object, targetPos: Object, sourceEl: REElement, targetEl: REElement } | null}
 */
export function resolveEdge(relation, positions, elements) {
  const sourcePos = positions[relation.from];
  const targetPos = positions[relation.to];
  if (!sourcePos || !targetPos) return null;
  const sourceEl = elements.find(el => el.id === relation.from);
  const targetEl = elements.find(el => el.id === relation.to);
  return { sourcePos, targetPos, sourceEl, targetEl };
}

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
 * @param {boolean}         props.isWithdrawn   - True when withdrawn at the current view.
 * @param {number}          props.opacity
 * @param {string}          [props.transition]
 * @param {string}          [props.cursor]
 * @param {Function}        [props.onMouseEnter]
 * @param {Function}        [props.onMouseLeave]
 * @param {React.ReactNode} [props.children]    - Extra rings rendered before the shape.
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

// ─── Visual-props factories ───────────────────────────────────────────────────

/**
 * Computes edge visual props for the History tab.
 * Future edges (not yet added at `snappedRound`) are hidden instantly;
 * past edges fade in over 2.2 s.
 *
 * @param {RERelation} relation
 * @param {Set<string>} wIds       - IDs of withdrawn elements at this round.
 * @param {number}      snappedRound
 * @returns {{ isWithdrawn: boolean, opacity: number, transition: string }}
 */
export function historyEdgeVisuals(relation, wIds, snappedRound) {
  const isWithdrawn = wIds.has(relation.from) || wIds.has(relation.to);
  const isFuture    = (relation.addedRound || 1) > snappedRound;
  return {
    isWithdrawn,
    opacity:    isFuture ? 0 : isWithdrawn ? 0.25 : 0.7,
    transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
  };
}

/**
 * Computes edge visual props for the Graph tab.
 * Applies selection dimming, selectedRel stroke-width boost, and hit area.
 *
 * @param {RERelation}       relation
 * @param {Set<string>}      wIds
 * @param {function(RERelation): boolean} dimEdge
 * @param {RERelation|null}  selectedRel
 * @returns {{ isWithdrawn: boolean, opacity: number, strokeWidth: number, transition: string, hitArea: boolean }}
 */
export function graphEdgeVisuals(relation, wIds, dimEdge, selectedRel) {
  const isWithdrawn = wIds.has(relation.from) || wIds.has(relation.to);
  const baseOpacity = isWithdrawn ? 0.25 : 0.7;
  return {
    isWithdrawn,
    opacity:     dimEdge(relation) ? baseOpacity * 0.12 : baseOpacity,
    strokeWidth: relation === selectedRel ? 3.5 : dimEdge(relation) ? 1.5 : 2,
    transition:  TRANSITION,
    hitArea:     true,
  };
}

/**
 * Computes node visual props for the History tab.
 * Future nodes are hidden instantly; past nodes fade in over 2.2 s.
 * Newly-added nodes receive a `<PulseRing>` child.
 *
 * @param {REElement}   element
 * @param {Set<string>} wIds
 * @param {Set<string>} newIds       - IDs added exactly at `snappedRound`.
 * @param {number}      snappedRound
 * @returns {{ isWithdrawn: boolean, opacity: number, transition: string, children: React.ReactNode }}
 */
export function historyNodeVisuals(element, wIds, newIds, snappedRound) {
  const isFuture    = element.addedRound > snappedRound;
  const isWithdrawn = wIds.has(element.id);
  const isNew       = newIds.has(element.id);
  return {
    isWithdrawn,
    opacity:    isFuture ? 0 : isWithdrawn ? 0.25 : confOp[element.confidence],
    transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
    children:   isNew && !isWithdrawn
      ? <PulseRing type={element.type} radius={nodeRadius(element.type)} />
      : null,
  };
}

/**
 * Computes node visual props for the Graph tab.
 * Applies selection dimming and a selection-ring child for the focused node.
 *
 * @param {REElement}   element
 * @param {Set<string>} wIds
 * @param {function(string): boolean} dimNode
 * @param {string|null} selected     - ID of the selected element, or null.
 * @returns {{ isWithdrawn: boolean, opacity: number, transition: string, children: React.ReactNode }}
 */
export function graphNodeVisuals(element, wIds, dimNode, selected) {
  const isWithdrawn = wIds.has(element.id);
  const isSelected  = element.id === selected;
  const baseOpacity = isWithdrawn ? 0.25 : confOp[element.confidence];
  return {
    isWithdrawn,
    opacity:    dimNode(element.id) ? 0.12 : baseOpacity,
    transition: TRANSITION,
    children:   isSelected
      ? <circle r={nodeRadius(element.type) + 8} fill="none" stroke="#fff" strokeWidth={2} opacity={0.45} />
      : null,
  };
}

// ─── Shared render functions ──────────────────────────────────────────────────

/**
 * Renders a single edge given pre-computed visual props.
 * Returns `null` when either endpoint position is missing.
 *
 * @param {RERelation}  relation
 * @param {number}      i         - Array index (used as React key).
 * @param {PositionMap} positions
 * @param {REElement[]} elements
 * @param {Object}      visuals   - Output of `historyEdgeVisuals` or `graphEdgeVisuals`.
 * @returns {React.ReactElement|null}
 */
export function renderEdge(relation, i, positions, elements, visuals) {
  const resolved = resolveEdge(relation, positions, elements);
  if (!resolved) return null;
  const { sourcePos, targetPos, sourceEl, targetEl } = resolved;
  return (
    <GraphEdge key={i}
      relation={relation} sourcePos={sourcePos} targetPos={targetPos}
      sourceEl={sourceEl} targetEl={targetEl}
      {...visuals} />
  );
}

/**
 * Renders a single node given pre-computed visual props.
 * Returns `null` when the element has no position yet.
 *
 * @param {REElement}   element
 * @param {PositionMap} positions
 * @param {Object}      visuals     - Output of `historyNodeVisuals` or `graphNodeVisuals`.
 * @param {boolean}     isDragging
 * @param {Function}    setTooltip
 * @returns {React.ReactElement|null}
 */
export function renderNode(element, positions, visuals, isDragging, setTooltip) {
  const position = positions[element.id];
  if (!position) return null;
  const { children = null, ...nodeProps } = visuals;
  return (
    <GraphNode key={element.id}
      element={element} position={position}
      cursor={isDragging ? "grabbing" : "pointer"}
      {...makeTooltipHandlers(isDragging, setTooltip, element)}
      {...nodeProps}>
      {children}
    </GraphNode>
  );
}

// ─── GraphCanvas ──────────────────────────────────────────────────────────────

/**
 * Shared SVG container used by both Graph and HistoryTab.
 *
 * Renders an absolutely-positioned container div with a pannable SVG inside,
 * a `NodeTooltip`, and an optional `overlay` slot for absolutely-positioned
 * content on top of the SVG (e.g. the history log panel).
 *
 * @param {Object}          props
 * @param {React.Ref}       props.containerRef
 * @param {{ w: number, h: number }} props.dims
 * @param {{ x: number, y: number }} props.pan
 * @param {boolean}         props.isDragging
 * @param {Function}        props.onPointerDown
 * @param {Function}        props.onPointerMove
 * @param {Function}        props.onPointerUp
 * @param {Object|null}     props.tooltip       - Tooltip state `{ x, y, el }` or null.
 * @param {React.CSSProperties} [props.containerStyle] - Extra styles for the outer div.
 * @param {React.ReactNode} [props.overlay]     - Absolutely-positioned content over the SVG.
 * @param {React.ReactNode} [props.children]    - SVG content rendered inside `<g transform>`.
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
