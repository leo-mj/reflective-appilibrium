/**
 * @fileoverview Interactive force-directed graph for the main Graph tab.
 * @module components/Graph
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useRef, useEffect } from "react";

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

// ─── Subcomponents ────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  judgment: C.judgment.high,
  principle: C.principle.high,
  theory: C.theory.high,
};

function AddButtonsOverlay({ onAddEl, onAddRel }) {
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
    </div>
  );
}

function GraphModals({
  addingElType,
  setAddingElType,
  addingRel,
  setAddingRel,
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
 * @param {boolean}     props.showWithdrawn
 * @param {boolean}     props.showRejected
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
  showWithdrawn,
  showRejected,
  positions,
  selected,
  onSelect,
  selectedRel,
  onSelectRel,
  onAddElement,
  onAddRelation,
  onCtrlSecondSelect,
  ready,
}) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  const [addingElType, setAddingElType] = useState(null);
  const [addingRel, setAddingRel] = useState(false);
  const [ctrlSelected, setCtrlSelected] = useState(null);

  // Clear ctrl-selection whenever the primary selection changes.
  useEffect(() => { setCtrlSelected(null); }, [selected]);

  // ── Derived visibility and highlight sets ─────────────────────────────────

  const { active, withdrawn } = elementsAtRound(state.elements, state.round);
  const wIds = new Set(withdrawn.map((e) => e.id));
  const rejectedEls = state.elements.filter((e) => e.status === "rejected");
  const visibleEls = [
    ...active,
    ...(showWithdrawn ? withdrawn : []),
    ...(showRejected ? rejectedEls : []),
  ];
  const visIds = new Set(visibleEls.map((e) => e.id));
  const visRels = state.relations.filter(
    (r) =>
      visIds.has(r.from) &&
      visIds.has(r.to) &&
      (showRejected || r.status !== "rejected") &&
      (showWithdrawn || r.status !== "withdrawn"),
  );

  const highlightedIds = ctrlSelected && selected
    ? new Set([selected, ctrlSelected])
    : selected
      ? getNeighbours(selected, visRels)
      : selectedRel
        ? new Set([selectedRel.from, selectedRel.to])
        : null;

  const dimNode = (id) => highlightedIds && !highlightedIds.has(id);
  const dimEdge = (r) => {
    if (selectedRel) return r !== selectedRel;
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
      if (selected) {
        setCtrlSelected(id);
        onCtrlSecondSelect?.(id);
      } else {
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
            graphEdgeVisuals(r, wIds, dimEdge, selectedRel),
          ),
        )}

        {/* ── Nodes ── */}
        {visibleEls.map((el) =>
          renderNode(
            el,
            positions,
            graphNodeVisuals(el, wIds, dimNode, selected),
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
        activeEls={activeEls}
        round={state.round}
        onAddElement={onAddElement}
        onAddRelation={onAddRelation}
      />
    </>
  );
}
