/**
 * @fileoverview Interactive force-directed graph for the main Graph tab.
 * @module components/Graph
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useRef } from "react";

import { C } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { useAutoFit } from "../hooks/useAutoFit.js";
import {
  hitRadius,
  getNeighbours,
  distToSegment,
} from "../utils/graphHelpers.js";
import { elementsAtRound } from "../utils/stateUtils.js";
import {
  GraphCanvas,
  OffscreenIndicators,
} from "./graphs_shared/GraphElements.jsx";
import {
  renderEdge,
  renderNode,
  graphEdgeVisuals,
  graphNodeVisuals,
} from "./graphs_shared/graphRender.jsx";
import { AddElementModal } from "./user_edits/AddElementModal.jsx";
import { AddRelationModal } from "./user_edits/AddRelationModal.jsx";
import { AddArgumentModal } from "./user_edits/AddArgumentModal.jsx";

// ─── Subcomponents ────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  judgment: C.judgment.high,
  principle: C.principle.high,
  theory: C.theory.high,
};

function AddButtonsOverlay({
  onAddEl,
  onAddRel,
  onAddArg,
  hideNonEntailsRels,
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {[
        ["judgment", "J"],
        ["principle", "P"],
        ["theory", "T"],
      ].map(([type, label]) => (
        <button
          key={type}
          onClick={() => onAddEl(type)}
          style={{
            background: TYPE_COLORS[type],
            border: "none",
            color: "#fff",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + {label}
        </button>
      ))}
      {!hideNonEntailsRels && (
        <button
          onClick={onAddRel}
          style={{
            background: C.border,
            border: "none",
            color: C.text,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Rel
        </button>
      )}
      <button
        onClick={onAddArg}
        style={{
          background: C.jointly_entails + "33",
          border: `1px solid ${C.jointly_entails}`,
          color: C.jointly_entails,
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        + Arg
      </button>
    </div>
  );
}

function ArgAccumulatorBar({ selected, ctrlArgNodes, onConfirm, onCancel }) {
  if (!selected || ctrlArgNodes.length === 0) return null;
  const all = [selected, ...ctrlArgNodes];
  const premises = all.slice(0, -1);
  const conclusion = all.at(-1);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: "50%",
        transform: "translateX(-50%)",
        background: C.panel,
        border: `1px solid ${C.jointly_entails}`,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12,
        color: C.text,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        zIndex: 10,
      }}
    >
      <span style={{ color: C.dim }}>
        {premises.join(", ")}
        <span style={{ color: C.jointly_entails, fontWeight: "bold", margin: "0 6px" }}>→</span>
        {conclusion}
      </span>
      <button
        onClick={onConfirm}
        style={{
          background: C.jointly_entails + "22",
          border: `1px solid ${C.jointly_entails}`,
          borderRadius: 4,
          color: C.jointly_entails,
          fontSize: 12,
          padding: "2px 10px",
          cursor: "pointer",
        }}
      >
        Add Argument
      </button>
      <button
        onClick={onCancel}
        style={{
          background: "transparent",
          border: "none",
          color: C.dim,
          fontSize: 14,
          cursor: "pointer",
          padding: "0 2px",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function GraphModals({
  addingElType,
  setAddingElType,
  addingRel,
  setAddingRel,
  addingArg,
  setAddingArg,
  addingArgPrefill,
  activeEls,
  round,
  onAddElement,
  onAddRelation,
}) {
  return (
    <>
      {addingElType && (
        <AddElementModal
          initialType={addingElType}
          currentRound={round}
          onSave={(formData) => {
            onAddElement(formData);
            setAddingElType(null);
          }}
          onCancel={() => setAddingElType(null)}
        />
      )}
      {addingRel && (
        <AddRelationModal
          elements={activeEls}
          currentRound={round}
          onSave={(formData) => {
            onAddRelation(formData);
            setAddingRel(false);
          }}
          onCancel={() => setAddingRel(false)}
        />
      )}
      {addingArg && (
        <AddArgumentModal
          elements={activeEls}
          currentRound={round}
          initialPremises={addingArgPrefill?.premises}
          initialConclusion={addingArgPrefill?.conclusion}
          onSave={({ premises, conclusion, explanation }) => {
            const argumentId = `arg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
            premises.forEach((premise, i) => {
              onAddRelation(
                {
                  from: premise,
                  to: conclusion,
                  type: "jointly_entails",
                  argumentId,
                  explanation,
                },
                { select: false, pinRecent: i === premises.length - 1 },
              );
            });
            setAddingArg(false);
          }}
          onCancel={() => setAddingArg(false)}
        />
      )}
    </>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Wraps `usePan` with click-vs-drag detection and graph hit-testing.
 * Returns merged pointer handlers plus the pan state from `usePan`.
 */
function useGraphClick({
  panDown,
  panUp,
  visibleEls,
  visRels,
  positions,
  pan,
  zoom,
  onSelect,
  onSelectRel,
  setTooltip,
  onCtrlNodeClick,
}) {
  const clickOrigin = useRef(null);

  /** @param {React.PointerEvent} e */
  const onPointerDown = (e) => {
    panDown(e);
    clickOrigin.current = {
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
    };
    // On touch, keep the existing tooltip visible until pointerUp resolves the tap.
    if (e.pointerType !== "touch") setTooltip(null);
  };

  /** @param {React.PointerEvent} e */
  const onPointerUp = (e) => {
    panUp(e);
    if (!clickOrigin.current) return;
    const { x: ox, y: oy, pointerType } = clickOrigin.current;
    clickOrigin.current = null;
    const threshold = pointerType === "touch" ? 10 : 4;
    if (
      Math.abs(e.clientX - ox) > threshold ||
      Math.abs(e.clientY - oy) > threshold
    )
      return; // drag

    // Convert screen → simulation coordinates (accounting for pan and zoom).
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = (e.clientX - rect.left - pan.x) / zoom;
    const sy = (e.clientY - rect.top - pan.y) / zoom;

    if (pointerType === "touch") {
      // Touch: tap shows/dismisses tooltip only — no focus/selection.
      for (const el of visibleEls) {
        const pos = positions[el.id];
        if (!pos) continue;
        if ((pos.x - sx) ** 2 + (pos.y - sy) ** 2 < hitRadius(el.type) ** 2) {
          setTooltip((prev) =>
            prev?.el?.id === el.id
              ? null
              : { x: e.clientX, y: e.clientY - 10, el },
          );
          return;
        }
      }
      // Tapped background — clear tooltip.
      setTooltip(null);
      return;
    }

    // Mouse: node hit-test → focus/selection.
    for (const el of visibleEls) {
      const pos = positions[el.id];
      if (!pos) continue;
      if ((pos.x - sx) ** 2 + (pos.y - sy) ** 2 < hitRadius(el.type) ** 2) {
        if (e.ctrlKey || e.metaKey) {
          onCtrlNodeClick(el.id);
        } else {
          onSelectRel(() => null);
          onSelect((prev) => (prev === el.id ? null : el.id));
        }
        return;
      }
    }

    // Edge hit-test (threshold 8 px).
    for (const r of visRels) {
      const sp = positions[r.from],
        tp = positions[r.to];
      if (!sp || !tp) continue;
      if (distToSegment(sx, sy, sp.x, sp.y, tp.x, tp.y) < 8) {
        onSelect(() => null);
        onSelectRel((prev) => (prev === r ? null : r));
        return;
      }
    }

    // Clicked background — clear selection.
    onSelect(() => null);
    onSelectRel(() => null);
  };

  return { onPointerDown, onPointerUp };
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Renders the main force-directed graph for the Graph tab.
 *
 * ### Layout
 * Node positions come from the shared `positions` prop produced by
 * {@link module:hooks/useStablePositions} in the parent `REState` component.
 * The graph itself does not run any simulation.
 *
 * ### Interaction
 * - **Pan** — drag anywhere on the SVG via {@link module:hooks/usePan}.
 * - **Click to highlight** — click a node to highlight it and its immediate
 *   neighbours; all other nodes and edges dim to low opacity.  Click the same
 *   node again, or click the background, to deselect.
 * - **Click an edge** — selects the relation; its two endpoint nodes highlight.
 * - **Hover tooltip** — hovering over a node shows a {@link module:components/NodeTooltip}.
 *
 * A click is distinguished from a drag by comparing pointer-up to pointer-down
 * positions (threshold: 4 px).
 *
 * @param {Object}      props
 * @param {REState}     props.state
 * @param {Set<string>} props.hiddenLegendKeys
 * @param {PositionMap} props.positions
 * @param {string|null} props.selected
 * @param {function(function): void} props.onSelect
 * @param {import('../types.js').RERelation|null} props.selectedRel
 * @param {function(function): void} props.onSelectRel
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 * @param {function}    [props.onCtrlSecondSelect] - Called with a node id when ctrl+click
 *   happens while another node is already selected. Used to fill the AddBar "to" field.
 * @param {boolean}     [props.ready] - When false, suppresses auto-fit until the force
 *   simulation has settled. Prevents fitting against initial clustered positions.
 * @returns {React.ReactElement}
 */
export function Graph({
  state,
  hiddenLegendKeys,
  positions,
  selected,
  onSelect,
  selectedRel,
  onSelectRel,
  onAddElement,
  onAddRelation,
  onCtrlSecondSelect,
  ready,
  recentlyAdded,
  hideNonEntailsRels,
  equilibriumPreviewWithdrawnIds,
}) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  const [addingElType, setAddingElType] = useState(null);
  const [addingRel, setAddingRel] = useState(false);
  const [addingArg, setAddingArg] = useState(false);
  const [addingArgPrefill, setAddingArgPrefill] = useState(null);
  // { base: string|null, nodes: string[] } — nodes invalidate automatically when selected !== base
  const [ctrlArgState, setCtrlArgState] = useState({ base: null, nodes: [] });
  const ctrlArgNodes = ctrlArgState.base === selected ? ctrlArgState.nodes : [];
  const clearCtrlArg = () => setCtrlArgState({ base: null, nodes: [] });

  // ── Derived visibility and highlight sets ─────────────────────────────────

  const { active, withdrawn } = elementsAtRound(state.elements, state.round);
  const wIds = new Set(withdrawn.map((e) => e.id));
  const rejectedEls = state.elements.filter((e) => e.status === "rejected");
  const isElVisible = (el) => {
    if (el.status === "withdrawn") return !hiddenLegendKeys?.has("withdrawn");
    if (el.status === "rejected") return !hiddenLegendKeys?.has("rejected");
    if (el.type === "judgment")
      return !hiddenLegendKeys?.has(`J-${el.confidence}`);
    if (el.type === "principle") return !hiddenLegendKeys?.has("P");
    if (el.type === "theory") return !hiddenLegendKeys?.has("T");
    return true;
  };
  const visibleEls = [...active, ...withdrawn, ...rejectedEls].filter(
    isElVisible,
  );
  const visIds = new Set(visibleEls.map((e) => e.id));
  const visRels = state.relations.filter(
    (r) =>
      visIds.has(r.from) &&
      visIds.has(r.to) &&
      !hiddenLegendKeys?.has(r.type) &&
      !(hiddenLegendKeys?.has("withdrawn") && r.status === "withdrawn") &&
      !(hiddenLegendKeys?.has("rejected") && r.status === "rejected") &&
      !(
        equilibriumPreviewWithdrawnIds?.has(r.from) ||
        equilibriumPreviewWithdrawnIds?.has(r.to)
      ),
  );

  // All relations belonging to the same argument as selectedRel (or just [selectedRel]).
  const selectedArgRels = selectedRel?.argumentId
    ? visRels.filter((r) => r.argumentId === selectedRel.argumentId)
    : selectedRel
      ? [selectedRel]
      : [];
  const selectedArgRelSet = new Set(selectedArgRels);

  const highlightedIds =
    ctrlArgNodes.length > 0 && selected
      ? new Set([selected, ...ctrlArgNodes])
      : selected
        ? getNeighbours(selected, visRels)
        : selectedArgRels.length > 0
          ? new Set(selectedArgRels.flatMap((r) => [r.from, r.to]))
          : null;

  const dimNode = (id) => highlightedIds && !highlightedIds.has(id);
  const dimEdge = (r) => {
    if (selectedRel) return !selectedArgRelSet.has(r);
    if (highlightedIds) return r.from !== selected && r.to !== selected;
    return false;
  };

  // ── Pan + click ───────────────────────────────────────────────────────────

  const {
    pan,
    zoom,
    isDragging,
    onPointerDown: panDown,
    onPointerMove,
    onPointerUp: panUp,
    onPointerCancel,
    applyWheel,
    zoomIn,
    zoomOut,
    resetView,
  } = usePan();

  useAutoFit({ positions, dims, resetView, enabled: ready });

  const { onPointerDown, onPointerUp } = useGraphClick({
    panDown,
    panUp,
    visibleEls,
    visRels,
    positions,
    pan,
    zoom,
    onSelect,
    onSelectRel,
    setTooltip,
    onCtrlNodeClick: (id) => {
      if (selected && id !== selected && !ctrlArgNodes.includes(id)) {
        setCtrlArgState((prev) => ({
          base: selected,
          nodes: prev.base === selected ? [...prev.nodes, id] : [id],
        }));
        onCtrlSecondSelect?.(id);
      } else if (!selected) {
        onSelectRel(() => null);
        onSelect((prev) => (prev === id ? null : id));
      }
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  const activeEls = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.status !== "rejected",
  );

  return (
    <>
      <GraphCanvas
        containerRef={containerRef}
        dims={dims}
        pan={pan}
        zoom={zoom}
        isDragging={isDragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        applyWheel={applyWheel}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        tooltip={tooltip}
        containerStyle={{ width: "100%", height: "100%" }}
        overlay={
          <>
            <AddButtonsOverlay
              onAddEl={setAddingElType}
              onAddRel={() => setAddingRel(true)}
              onAddArg={() => setAddingArg(true)}
              hideNonEntailsRels={hideNonEntailsRels}
            />
            <ArgAccumulatorBar
              selected={selected}
              ctrlArgNodes={ctrlArgNodes}
              onConfirm={() => {
                const all = [selected, ...ctrlArgNodes];
                setAddingArgPrefill({ premises: all.slice(0, -1), conclusion: all.at(-1) });
                setAddingArg(true);
                clearCtrlArg();
              }}
              onCancel={clearCtrlArg}
            />
            <OffscreenIndicators
              els={visibleEls}
              positions={positions}
              pan={pan}
              zoom={zoom}
              dims={dims}
              color={C.dim}
            />
          </>
        }
      >
        {/* ── Edges ── */}
        {visRels.map((r) =>
          renderEdge(
            r,
            positions,
            state.elements,
            graphEdgeVisuals(r, wIds, dimEdge, selectedArgRelSet),
          ),
        )}

        {/* ── Nodes ── */}
        {visibleEls.map((el) =>
          renderNode(
            el,
            positions,
            graphNodeVisuals(
              el,
              wIds,
              dimNode,
              selected,
              undefined,
              recentlyAdded,
              equilibriumPreviewWithdrawnIds,
            ),
            isDragging,
            setTooltip,
          ),
        )}
      </GraphCanvas>

      <GraphModals
        addingElType={addingElType}
        setAddingElType={setAddingElType}
        addingRel={addingRel}
        setAddingRel={setAddingRel}
        addingArg={addingArg}
        setAddingArg={(v) => { if (!v) setAddingArgPrefill(null); setAddingArg(v); }}
        addingArgPrefill={addingArgPrefill}
        activeEls={activeEls}
        round={state.round}
        onAddElement={onAddElement}
        onAddRelation={onAddRelation}
      />
    </>
  );
}
