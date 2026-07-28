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

import { C, confOp, TRANSITION } from "../../constants/colors.js";
import { nodeRadius, computeJunction } from "../../utils/graphHelpers.js";
import { isWithdrawnAt } from "../../utils/stateUtils.js";
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
 * @param {RERelation}            relation
 * @param {PositionMap}           positions
 * @param {Map<string,REElement>} elementById
 * @returns {{ sourcePos: Object, targetPos: Object, sourceEl: REElement, targetEl: REElement } | null}
 */
export function resolveEdge(relation, positions, elementById) {
  const sourcePos = positions[relation.from];
  const targetPos = positions[relation.to];
  if (!sourcePos || !targetPos) return null;
  const sourceEl = elementById.get(relation.from);
  const targetEl = elementById.get(relation.to);
  return { sourcePos, targetPos, sourceEl, targetEl };
}

// ─── Visual-props factories ───────────────────────────────────────────────────

/**
 * Computes edge visual props for the History tab.
 * Future edges (not yet added at `snappedRound`) are hidden instantly;
 * past edges fade in over 2.2 s.
 *
 * For a joint argument, pass every relation in the group as `groupRels`: the
 * whole argument greys out if the conclusion or ANY premise is withdrawn, since
 * without every premise the conclusion is no longer jointly entailed.
 *
 * @param {RERelation}   relation
 * @param {Set<string>}  wIds         - IDs of withdrawn elements at this round.
 * @param {number}       snappedRound
 * @param {RERelation[]} [groupRels]  - Sibling relations for a joint argument; defaults to `[relation]`.
 * @returns {{ isWithdrawn: boolean, opacity: number, transition: string }}
 */
export function historyEdgeVisuals(relation, wIds, snappedRound, groupRels = null) {
  const edges = groupRels ?? [relation];
  // Either endpoint being gone takes the edge with it, and the relation can also
  // have been withdrawn on its own while both endpoints stayed in play.
  const isWithdrawn = edges.some(
    (r) => wIds.has(r.from) || wIds.has(r.to) || isWithdrawnAt(r, snappedRound),
  );
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
 * For a joint argument, pass every relation in the group as `groupRels`: the
 * whole argument greys out if the conclusion or ANY premise is withdrawn, since
 * without every premise the conclusion is no longer jointly entailed.
 *
 * @param {RERelation}                    relation
 * @param {Set<string>}                   wIds
 * @param {function(RERelation): boolean} dimEdge
 * @param {Set<RERelation>|null}          selectedRelGroup - set of relations in the selected argument group
 * @param {RERelation[]}                  [groupRels]      - Sibling relations for a joint argument; defaults to `[relation]`.
 * @returns {{ isWithdrawn: boolean, isRejected: boolean, opacity: number, strokeWidth: number, transition: string, hitArea: boolean }}
 */
export function graphEdgeVisuals(relation, wIds, dimEdge, selectedRelGroup, groupRels = null) {
  const edges = groupRels ?? [relation];
  const isWithdrawn = edges.some(
    (r) => wIds.has(r.from) || wIds.has(r.to) || r.status === "withdrawn",
  );
  const isRejected = relation.status === "rejected";
  const baseOpacity = isWithdrawn ? 0.25 : isRejected ? 0.35 : 0.7;
  return {
    isWithdrawn,
    isRejected,
    opacity: dimEdge(relation) ? baseOpacity * 0.12 : baseOpacity,
    strokeWidth: selectedRelGroup?.has(relation) ? 3.5 : dimEdge(relation) ? 1.5 : 2,
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
  const isFuture = (element.addedRound || 1) > snappedRound;
  const isWithdrawn = wIds.has(element.id);
  const isNew = newIds.has(element.id);
  return {
    isWithdrawn,
    opacity: isFuture ? 0 : isWithdrawn ? 0.25 : confOp(element.confidence),
    transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
    children:
      isNew && !isWithdrawn ? (
        <PulseRing type={element.type} radius={nodeRadius(element.type, element.confidence)} />
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
 * @param {string|null}                selected   - ID of the selected element, or null.
 * @param {string|null}                [ctrlFirst] - ID of the ctrl-click first node, or null.
 * @param {string|null}                [recentlyAdded]
 * @param {Set<string>|null}           [previewWithdrawnIds] - IDs that would be withdrawn by the simulated equilibrium.
 * @returns {{ isWithdrawn: boolean, isRejected: boolean, opacity: number, transition: string, children: React.ReactNode }}
 */
export function graphNodeVisuals(element, wIds, dimNode, selected, ctrlFirst, recentlyAdded, previewWithdrawnIds) {
  const isWithdrawn = wIds.has(element.id);
  const isRejected = element.status === "rejected";
  const isSelected = element.id === selected;
  const isCtrlFirst = element.id === ctrlFirst;
  const isRecentlyAdded = element.id === recentlyAdded;
  const isPreviewWithdrawn = previewWithdrawnIds?.has(element.id) ?? false;
  const baseOpacity =
    isWithdrawn || isPreviewWithdrawn ? 0.25 : isRejected ? 0.35 : confOp(element.confidence);
  const r = nodeRadius(element.type, element.confidence);
  return {
    isWithdrawn: isWithdrawn || isPreviewWithdrawn,
    isRejected,
    opacity: dimNode(element.id) ? 0.12 : baseOpacity,
    transition: TRANSITION,
    children: isSelected ? (
      <circle
        r={r + 8}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        opacity={0.45}
      />
    ) : isPreviewWithdrawn ? (
      <circle
        r={r + 6}
        fill="none"
        stroke={C.conflicts}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        opacity={0.7}
      />
    ) : isCtrlFirst || isRecentlyAdded ? (
      <PulseRing type={element.type} radius={r} />
    ) : null,
  };
}

// ─── Shared render functions ──────────────────────────────────────────────────

/**
 * Renders a multi-premise joint argument as converging lines → junction dot → conclusion arrow.
 *
 * All relations in `rels` share the same `argumentId` and conclusion (`to`).
 * Returns `null` when any required position is missing.
 *
 * @param {RERelation[]}        rels
 * @param {PositionMap}         positions
 * @param {Map<string,REElement>} elementById
 * @param {Object}              visuals  - Output of `graphEdgeVisuals` for the group.
 * @returns {React.ReactElement|null}
 */
export function renderJointArgument(rels, positions, elementById, visuals) {
  const conclusionId = rels[0].to;
  const conclusionEl = elementById.get(conclusionId);
  const conclusionPos = positions[conclusionId];
  if (!conclusionPos || !conclusionEl) return null;

  const { isWithdrawn, opacity, strokeWidth = 2, transition } = visuals;
  const color = isWithdrawn ? C.withdrawn : C[rels[0].type];

  const premises = rels
    .map((r) => ({ r, el: elementById.get(r.from), pos: positions[r.from] }))
    .filter((d) => d.el && d.pos);
  if (premises.length === 0) return null;

  // Conclusion node radius — needed for junction clamping and arrow geometry.
  const tr = nodeRadius(conclusionEl.type, conclusionEl.confidence);

  const centX = premises.reduce((s, d) => s + d.pos.x, 0) / premises.length;
  const centY = premises.reduce((s, d) => s + d.pos.y, 0) / premises.length;
  const { jx, jy } = computeJunction(centX, centY, conclusionPos, tr);

  // Conclusion arrow geometry
  const adx = conclusionPos.x - jx, ady = conclusionPos.y - jy;
  const adist = Math.hypot(adx, ady) || 1;
  const aux = adx / adist, auy = ady / adist;
  const tipX = conclusionPos.x - aux * tr;
  const tipY = conclusionPos.y - auy * tr;
  const bx = tipX - aux * 10, by = tipY - auy * 10;
  const aperpX = -auy, aperpY = aux;

  return (
    <g opacity={opacity} style={{ transition }}>
      {premises.map(({ r, el, pos }) => {
        const sr = nodeRadius(el.type, el.confidence);
        const dx = jx - pos.x, dy = jy - pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        return (
          <line
            key={r.from}
            x1={pos.x + (dx / dist) * sr} y1={pos.y + (dy / dist) * sr}
            x2={jx} y2={jy}
            stroke={color} strokeWidth={strokeWidth}
          />
        );
      })}
      <circle cx={jx} cy={jy} r={4} fill={color} />
      <line x1={jx} y1={jy} x2={bx} y2={by} stroke={color} strokeWidth={strokeWidth} />
      <polygon
        points={`${tipX},${tipY} ${bx + aperpX * 5},${by + aperpY * 5} ${bx - aperpX * 5},${by - aperpY * 5}`}
        fill={color}
      />
    </g>
  );
}

/**
 * Renders a single edge given pre-computed visual props.
 * Returns `null` when either endpoint position is missing.
 *
 * @param {RERelation}  relation
 * @param {PositionMap} positions
 * @param {Map<string,REElement>} elementById
 * @param {Object}      visuals   - Output of `historyEdgeVisuals` or `graphEdgeVisuals`.
 * @returns {React.ReactElement|null}
 */
export function renderEdge(relation, positions, elementById, visuals, parallelOffset = 0) {
  const resolved = resolveEdge(relation, positions, elementById);
  if (!resolved) return null;
  const { sourcePos, targetPos, sourceEl, targetEl } = resolved;
  return (
    <GraphEdge
      key={`${relation.from}-${relation.to}-${relation.type}-${relation.addedRound ?? 1}`}
      relation={relation}
      sourcePos={sourcePos}
      targetPos={targetPos}
      sourceEl={sourceEl}
      targetEl={targetEl}
      parallelOffset={parallelOffset}
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
