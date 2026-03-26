/**
 * @fileoverview Non-component render helpers and visual-props factories shared
 * by Graph and HistoryTab.
 *
 * Kept separate from GraphElements.jsx so that file contains only React
 * components (required for react-refresh fast-reload to work correctly).
 *
 * @module utils/graphRender
 */

/** @import { REElement, RERelation, PositionMap } from '../../types.js' */

import { confOp, TRANSITION } from "../../constants/colors.js";
import { nodeRadius } from "../../utils/graphHelpers.js";
import { GraphEdge, GraphNode, PulseRing } from "./GraphElements.jsx";

// ─── Tooltip handler factory ──────────────────────────────────────────────────

/**
 * Returns `onMouseEnter` / `onMouseLeave` handlers that update a tooltip state.
 * The handler is a no-op while the user is dragging.
 * On touch devices, tooltips are shown on tap via `useGraphClick` instead.
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
      setTooltip({ x: ev.clientX, y: ev.clientY - 10, el: element });
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
  const sourceEl = elements.find((el) => el.id === relation.from);
  const targetEl = elements.find((el) => el.id === relation.to);
  return { sourcePos, targetPos, sourceEl, targetEl };
}

// ─── Visual-props factories ───────────────────────────────────────────────────

/**
 * Computes edge visual props for the History tab.
 * Future edges (not yet added at `snappedRound`) are hidden instantly;
 * past edges fade in over 2.2 s.
 *
 * @param {RERelation}  relation
 * @param {Set<string>} wIds         - IDs of withdrawn elements at this round.
 * @param {number}      snappedRound
 * @returns {{ isWithdrawn: boolean, opacity: number, transition: string }}
 */
export function historyEdgeVisuals(relation, wIds, snappedRound) {
  const isWithdrawn = wIds.has(relation.from) || wIds.has(relation.to);
  const isFuture = (relation.addedRound || 1) > snappedRound;
  return {
    isWithdrawn,
    opacity: isFuture ? 0 : isWithdrawn ? 0.25 : 0.7,
    transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
  };
}

/**
 * Computes edge visual props for the Graph tab.
 * Applies selection dimming, selectedRel stroke-width boost, and hit area.
 *
 * @param {RERelation}                    relation
 * @param {Set<string>}                   wIds
 * @param {function(RERelation): boolean} dimEdge
 * @param {RERelation|null}               selectedRel
 * @returns {{ isWithdrawn: boolean, opacity: number, strokeWidth: number, transition: string, hitArea: boolean }}
 */
export function graphEdgeVisuals(relation, wIds, dimEdge, selectedRel) {
  const isWithdrawn = wIds.has(relation.from) || wIds.has(relation.to);
  const baseOpacity = isWithdrawn ? 0.25 : 0.7;
  return {
    isWithdrawn,
    opacity: dimEdge(relation) ? baseOpacity * 0.12 : baseOpacity,
    strokeWidth: relation === selectedRel ? 3.5 : dimEdge(relation) ? 1.5 : 2,
    transition: TRANSITION,
    hitArea: true,
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
  const isFuture = element.addedRound > snappedRound;
  const isWithdrawn = wIds.has(element.id);
  const isNew = newIds.has(element.id);
  return {
    isWithdrawn,
    opacity: isFuture ? 0 : isWithdrawn ? 0.25 : confOp[element.confidence],
    transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
    children:
      isNew && !isWithdrawn ? (
        <PulseRing type={element.type} radius={nodeRadius(element.type)} />
      ) : null,
  };
}

/**
 * Computes node visual props for the Graph tab.
 * Applies selection dimming and a selection-ring child for the focused node.
 *
 * @param {REElement}                  element
 * @param {Set<string>}                wIds
 * @param {function(string): boolean}  dimNode
 * @param {string|null}                selected - ID of the selected element, or null.
 * @returns {{ isWithdrawn: boolean, opacity: number, transition: string, children: React.ReactNode }}
 */
export function graphNodeVisuals(element, wIds, dimNode, selected) {
  const isWithdrawn = wIds.has(element.id);
  const isSelected = element.id === selected;
  const baseOpacity = isWithdrawn ? 0.25 : confOp[element.confidence];
  return {
    isWithdrawn,
    opacity: dimNode(element.id) ? 0.12 : baseOpacity,
    transition: TRANSITION,
    children: isSelected ? (
      <circle
        r={nodeRadius(element.type) + 8}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        opacity={0.45}
      />
    ) : null,
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
    <GraphEdge
      key={i}
      relation={relation}
      sourcePos={sourcePos}
      targetPos={targetPos}
      sourceEl={sourceEl}
      targetEl={targetEl}
      {...visuals}
    />
  );
}

/**
 * Renders a single node given pre-computed visual props.
 * Returns `null` when the element has no position yet.
 *
 * @param {REElement}   element
 * @param {PositionMap} positions
 * @param {Object}      visuals   - Output of `historyNodeVisuals` or `graphNodeVisuals`.
 * @param {boolean}     isDragging
 * @param {Function}    setTooltip
 * @returns {React.ReactElement|null}
 */
export function renderNode(
  element,
  positions,
  visuals,
  isDragging,
  setTooltip,
) {
  const position = positions[element.id];
  if (!position) return null;
  const { children = null, ...nodeProps } = visuals;
  return (
    <GraphNode
      key={element.id}
      element={element}
      position={position}
      cursor={isDragging ? "grabbing" : "pointer"}
      {...makeTooltipHandlers(isDragging, setTooltip, element)}
      {...nodeProps}
    >
      {children}
    </GraphNode>
  );
}
