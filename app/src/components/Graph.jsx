/**
 * @fileoverview Interactive force-directed graph for the main Graph tab.
 * @module components/Graph
 */

/** @import { REState, PositionMap } from '../types.js' */

import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";

import { C, typeTokens, inkOn } from "../constants/colors.js";
import { usePalette } from "../hooks/useTheme.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { useAutoFit } from "../hooks/useAutoFit.js";
import { useGraphClick } from "../hooks/useGraphClick.js";
import {
  elementRadius,
  fitView,
  getNeighbours,
  parallelEdgeOffsets,
  groupJointArguments,
} from "../utils/graphHelpers.js";
import { groupsOf, projectGroups, selectionIds } from "../utils/groupUtils.js";
import {
  elementsAtRound,
  argumentRelationType,
  linkableElements,
  newArgumentId,
} from "../utils/stateUtils.js";
import {
  GraphCanvas,
  GroupHull,
  OffscreenIndicators,
} from "./graphs_shared/GraphElements.jsx";
import { GroupChips } from "./graphs_shared/GroupChips.jsx";
import {
  renderEdge,
  renderJointArgument,
  renderNode,
  graphEdgeVisuals,
  graphNodeVisuals,
} from "./graphs_shared/graphRender.jsx";
import { Tooltip } from "./Tooltip.jsx";
import { ActionButtons } from "./text_panel/TextTabPrimitives.jsx";
import { AddElementModal } from "./user_edits/AddElementModal.jsx";
import { AddRelationModal } from "./user_edits/AddRelationModal.jsx";
import { AddArgumentModal } from "./user_edits/AddArgumentModal.jsx";

// ─── Subcomponents ────────────────────────────────────────────────────────────

/** Withdrawn and rejected elements offer Reinstate where others offer Withdraw. */
const isInPlay = (el) => el.status !== "withdrawn" && el.status !== "rejected";

function AddButtonsOverlay({
  onAddEl,
  onAddRel,
  onAddArg,
  onAddGroup,
  hideNonEntailsRels,
}) {
  const palette = usePalette();
  return (
    <div
      // Ringed by the tour when it gets to making your own position.
      data-tutorial="graph-add"
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
          aria-label={`Add ${type}`}
          title={`Add ${type}`}
          style={{
            // Fill matches the nodes it adds, in whichever mode is on. The ink
            // does not: this is an HTML control, where AA is enforced and the
            // node palette's black lands at 3.7:1 on the saturated violet. The
            // nodes themselves are a deliberate exception to that; a button is
            // not.
            background: typeTokens(type, palette).high,
            border: "none",
            color: inkOn(typeTokens(type, palette).high),
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
          aria-label="Add relation"
          title="Add relation"
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
        aria-label="Add argument"
        title="Add argument"
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
      {/* The one affordance that says grouping exists at all. Ctrl-clicking
          nodes and choosing Group is the quicker way and the tooltip says so,
          but nobody discovers a modifier key by looking at a canvas. Chrome
          colours, not a relation's: a group asserts nothing. */}
      <Tooltip text="Bracket elements into a group, which can then collapse into one node. Ctrl/⌘-click nodes on the graph to group them there instead.">
        <button
          onClick={onAddGroup}
          aria-label="New group"
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.dim,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
            width: "100%",
          }}
        >
          + Grp
        </button>
      </Tooltip>
    </div>
  );
}

/**
 * Floating bar summarising a ctrl+click selection, with a button to turn it
 * into an argument — or, when `asRelation`, into a single relation whose type
 * is picked in the modal that follows.
 */
function CtrlSelectionBar({
  selected,
  ctrlArgNodes,
  asRelation,
  onConfirm,
  onGroup,
  onCancel,
}) {
  if (!selected || ctrlArgNodes.length === 0) return null;
  const all = [selected, ...ctrlArgNodes];
  const premises = all.slice(0, -1);
  const conclusion = all.at(-1);
  // A relation's type is not chosen yet, so the bar stays neutral rather than
  // borrowing the entails colour.
  const accent = asRelation ? C.border : C.jointly_entails;
  const label = asRelation ? C.text : C.jointly_entails;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: "50%",
        transform: "translateX(-50%)",
        background: C.panel,
        border: `1px solid ${accent}`,
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
        <span
          style={{
            color: label,
            fontWeight: "bold",
            margin: "0 6px",
          }}
        >
          →
        </span>
        {conclusion}
      </span>
      <button
        onClick={onConfirm}
        style={{
          background: asRelation ? "transparent" : C.jointly_entails + "22",
          border: `1px solid ${accent}`,
          borderRadius: 4,
          color: label,
          fontSize: 12,
          padding: "2px 10px",
          cursor: "pointer",
        }}
      >
        {asRelation ? "Add relation" : "Add argument"}
      </button>
      {/* Same selection, a different thing to do with it. Grouping says nothing
          about what follows from what, so it sits apart from the inferential
          action rather than replacing it. */}
      <button
        onClick={onGroup}
        aria-label="Group the selected elements"
        style={{
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.dim,
          fontSize: 12,
          padding: "2px 10px",
          cursor: "pointer",
        }}
      >
        Group
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
  addingRelPrefill,
  addingArg,
  setAddingArg,
  addingArgPrefill,
  linkableEls,
  round,
  onAddElement,
  onAddRelation,
}) {
  // Half-written forms, kept for as long as the graph is on screen. The dialogs
  // themselves unmount when dismissed, so their own state cannot survive it —
  // and a modal is easy to close by accident. This component is never
  // unmounted, and it is below the graph, so keeping them here costs a render
  // of the open dialog per keystroke and nothing above it.
  const [drafts, setDrafts] = useState({
    element: null,
    relation: null,
    argument: null,
  });
  // Stable per kind: the dialogs report their form from an effect keyed on this
  // callback, and a fresh function each render would set it running in a loop.
  const keepElement = useCallback(
    (v) => setDrafts((d) => ({ ...d, element: v })),
    [],
  );
  const keepRelation = useCallback(
    (v) => setDrafts((d) => ({ ...d, relation: v })),
    [],
  );
  const keepArgument = useCallback(
    (v) => setDrafts((d) => ({ ...d, argument: v })),
    [],
  );
  // Committed work is not a draft. Without this the next dialog would open on
  // the form that was just submitted.
  const forget = (which) => setDrafts((d) => ({ ...d, [which]: null }));

  return (
    <>
      {addingElType && (
        <AddElementModal
          initialType={addingElType}
          currentRound={round}
          draft={drafts.element}
          onDraftChange={keepElement}
          onSave={(formData) => {
            onAddElement(formData);
            forget("element");
            setAddingElType(null);
          }}
          onCancel={() => setAddingElType(null)}
        />
      )}
      {addingRel && (
        <AddRelationModal
          elements={linkableEls}
          currentRound={round}
          initialFrom={addingRelPrefill?.from}
          initialTo={addingRelPrefill?.to}
          draft={drafts.relation}
          onDraftChange={keepRelation}
          onSave={(formData) => {
            onAddRelation(formData);
            forget("relation");
            setAddingRel(false);
          }}
          onCancel={() => setAddingRel(false)}
        />
      )}
      {addingArg && (
        <AddArgumentModal
          elements={linkableEls}
          currentRound={round}
          initialPremises={addingArgPrefill?.premises}
          initialConclusion={addingArgPrefill?.conclusion}
          draft={drafts.argument}
          onDraftChange={keepArgument}
          onSave={({ premises, conclusion, negated, explanation }) => {
            const argumentId = newArgumentId();
            const type = argumentRelationType(premises.length, negated);
            premises.forEach((premise, i) => {
              onAddRelation(
                {
                  from: premise,
                  to: conclusion,
                  type,
                  argumentId,
                  explanation,
                },
                { select: false, pinRecent: i === premises.length - 1 },
              );
            });
            forget("argument");
            setAddingArg(false);
          }}
          onCancel={() => setAddingArg(false)}
        />
      )}
    </>
  );
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
 * - **Group** — the ctrl+click selection can also be bracketed into a group,
 *   which the chip over it then collapses into a single node and expands again.
 *
 * A click is distinguished from a drag by comparing pointer-up to pointer-down
 * positions (threshold: 4 px).
 *
 * ### Groups
 * Everything from `projectGroups` down works on the *projected* graph, in which
 * a collapsed group is one node and the relations crossing its boundary run to
 * that node instead of to its members. See {@link module:utils/groupUtils}.
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
 * @param {{ key: number, ids: string[]|null }|null} [props.focus] - Frames a
 *   subset of the graph, or all of it when `ids` is null. Driven by the guided
 *   tour, which zooms to whatever its current section is talking about.
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
  onEditRequest,
  onWithdrawRequest,
  onReinstate,
  onCtrlSecondSelect,
  onCreateGroup,
  onToggleGroup,
  onEditGroupRequest,
  onUngroup,
  ready,
  recentlyAdded,
  hideNonEntailsRels,
  equilibriumPreviewWithdrawnIds,
  focus,
}) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  // Clicking a node pins its tooltip open with the same actions the text tab
  // offers. It takes precedence over the hover tooltip until dismissed.
  const [pinned, setPinned] = useState(null);
  const [addingElType, setAddingElType] = useState(null);
  const [addingRel, setAddingRel] = useState(false);
  const [addingArg, setAddingArg] = useState(false);
  const [addingArgPrefill, setAddingArgPrefill] = useState(null);
  const [addingRelPrefill, setAddingRelPrefill] = useState(null);
  // { base: string|null, nodes: string[] } — nodes invalidate automatically when selected !== base
  const [ctrlArgState, setCtrlArgState] = useState({ base: null, nodes: [] });
  const ctrlArgNodes = ctrlArgState.base === selected ? ctrlArgState.nodes : [];
  const clearCtrlArg = () => setCtrlArgState({ base: null, nodes: [] });

  // ── Derived visibility and highlight sets ─────────────────────────────────

  const { active, withdrawn } = elementsAtRound(state.elements, state.round);
  const wIds = new Set(withdrawn.map((e) => e.id));
  const rejectedEls = state.elements.filter((e) => e.status === "rejected");
  const isElVisible = (el) => {
    if (el.status === "possible") return false;
    if (el.status === "withdrawn") return !hiddenLegendKeys?.has("withdrawn");
    if (el.status === "rejected") return !hiddenLegendKeys?.has("rejected");
    if (el.type === "judgment") return !hiddenLegendKeys?.has("J");
    if (el.type === "principle") return !hiddenLegendKeys?.has("P");
    if (el.type === "theory") return !hiddenLegendKeys?.has("T");
    return true;
  };
  const visibleEls = [
    // `elementsAtRound` splits purely on round and withdrawal, so a rejected
    // element comes back in `active` too; dropping it here stops it from being
    // drawn twice.
    ...active.filter((e) => e.status !== "rejected"),
    ...withdrawn,
    ...rejectedEls,
  ].filter(isElVisible);
  // What the add modals may reference. Deliberately not narrowed by the legend:
  // hiding withdrawn nodes to declutter the canvas should not also remove them
  // from the pickers.
  const linkableEls = linkableElements(state.elements);
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

  // ── Groups ────────────────────────────────────────────────────────────────
  // Everything below this point works on the *projected* graph: a collapsed
  // group is one node, its internal edges are gone, and every edge that crossed
  // its boundary now runs to the group. Projecting after the visibility filter
  // rather than before it is what keeps the two consistent — a group whose
  // members the legend has hidden has nothing left to stand for.
  const {
    elements: displayEls,
    relations: displayRels,
    relSource,
    positions: displayPositions,
    hulls,
    groupNodes,
  } = projectGroups({
    elements: visibleEls,
    relations: visRels,
    groups: groupsOf(state),
    positions,
    radiusOf: elementRadius,
  });
  /** The relation as held in state — see `relSource` in utils/groupUtils. */
  const toSourceRel = (r) => relSource.get(r) ?? r;
  const groupIds = new Set(groupNodes.map((g) => g.id));

  // What the selection covers, narrowed to what is actually on the canvas: a
  // selected group is its own node while collapsed and its members once
  // expanded, and it can be selected in either state.
  const displayIds = new Set(displayEls.map((e) => e.id));
  const focusIds = selectionIds(groupsOf(state), selected).filter((id) =>
    displayIds.has(id),
  );
  const focusSet = new Set(focusIds);

  // All relations belonging to the same argument as selectedRel (or just the
  // edges standing for it, of which a re-pointed one is not the same object).
  const selectedArgRels = selectedRel?.argumentId
    ? displayRels.filter((r) => r.argumentId === selectedRel.argumentId)
    : selectedRel
      ? displayRels.filter((r) => toSourceRel(r) === selectedRel)
      : [];
  const selectedArgRelSet = new Set(selectedArgRels);

  const highlightedIds =
    ctrlArgNodes.length > 0 && selected
      ? new Set([selected, ...ctrlArgNodes])
      : focusIds.length > 0
        ? new Set(focusIds.flatMap((id) => [...getNeighbours(id, displayRels)]))
        : selectedArgRels.length > 0
          ? new Set(selectedArgRels.flatMap((r) => [r.from, r.to]))
          : null;

  const dimNode = (id) => highlightedIds && !highlightedIds.has(id);
  const dimEdge = (r) => {
    if (selectedRel) return !selectedArgRelSet.has(r);
    if (highlightedIds) return !focusSet.has(r.from) && !focusSet.has(r.to);
    return false;
  };

  const stateElementById = useMemo(
    () => new Map(state.elements.map((e) => [e.id, e])),
    [state.elements],
  );
  // Group nodes belong here too: edge geometry and hit-testing look their
  // endpoints up in this map, and a collapsed group is now one of them.
  const elementById = new Map(stateElementById);
  for (const g of groupNodes) elementById.set(g.id, g);

  const { solo: soloRels, jointGroups } = groupJointArguments(displayRels);
  const edgeOffsets = parallelEdgeOffsets(soloRels);

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

  // The raw positions, not the projected ones: a collapsed group's members keep
  // theirs, so framing still covers the ground the group is standing on — and
  // the tour, below, can frame an element that is currently inside one.
  useAutoFit({ positions, dims, resetView, enabled: ready });

  // The tour re-frames the graph on the elements the section being read names.
  // Keyed on `focus.key` rather than on the ids, so the same section framed
  // again — scrolled back to, or reached after the panel resized — still fits.
  // `positions` is deliberately not a dependency: this fires when the tour
  // moves on, not on every tick of the simulation.
  const focusKey = focus?.key;
  useEffect(() => {
    if (!focusKey) return;
    const view = fitView(positions, focus.ids ?? null, dims, {
      padding: focus.ids ? 200 : 96,
      maxZoom: focus.ids ? 1.5 : 1,
    });
    if (view) resetView(view.pan, view.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, dims.w, dims.h, ready]);

  const { onPointerDown, onPointerUp } = useGraphClick({
    panDown,
    panUp,
    visibleEls: displayEls,
    visRels: displayRels,
    jointGroups,
    elementById,
    edgeOffsets,
    positions: displayPositions,
    hulls,
    pan,
    zoom,
    onSelect,
    onSelectRel,
    toSourceRel,
    setTooltip,
    onNodeClick: (el, clientX, clientY) => {
      // A group is a lid, not a claim. Clicking one opens it — and re-asserts
      // the selection rather than toggling it off, because what the click was
      // aimed at is about to be replaced by the members underneath, and a
      // toggle would leave them with nothing holding the chip on screen.
      if (el?.type === "group") {
        setPinned(null);
        onSelect(() => el.id);
        onToggleGroup?.(el.id, false);
        return;
      }
      // Clicking the pinned node again closes it, matching how selection toggles.
      setPinned((prev) =>
        !el || prev?.el?.id === el.id
          ? null
          : { x: clientX, y: clientY - 10, el },
      );
    },
    onHullClick: (groupId) => {
      // The only handle an expanded group has left: its members are ordinary
      // nodes, and clicking one of those selects the element, not the box.
      setPinned(null);
      onSelect((prev) => (prev === groupId ? null : groupId));
    },
    onCtrlNodeClick: (id) => {
      // A group is a box, not a claim: it cannot be a premise, a conclusion or
      // the end of a relation, so ctrl+click has nothing to accumulate here.
      if (groupIds.has(id) || groupIds.has(selected)) return;
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

  // A relation is binary, so it is only on offer for a two-node selection, and
  // only where non-argument relations are visible at all.
  const ctrlSelectionIsRelation =
    !hideNonEntailsRels && ctrlArgNodes.length === 1;

  // A pinned card outlives the click that opened it, so it has to let go when
  // the node underneath stops being drawn — expanding a group from its chip
  // dissolves exactly the node whose members the card is listing.
  const pinnedNode =
    pinned && displayEls.some((e) => e.id === pinned.el.id) ? pinned : null;

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
        tooltip={pinnedNode ?? tooltip}
        tooltipActions={
          // Nothing for a group: revising and withdrawing are things you do to
          // a claim, and what you can do to a group is on its chip already.
          pinnedNode &&
          pinnedNode.el.type !== "group" && (
            <ActionButtons
              onRevise={() => {
                onEditRequest?.(pinnedNode.el.id);
                setPinned(null);
              }}
              onWithdraw={
                isInPlay(pinnedNode.el)
                  ? () => {
                      onWithdrawRequest?.(pinnedNode.el.id);
                      setPinned(null);
                    }
                  : null
              }
              onReinstate={
                isInPlay(pinnedNode.el)
                  ? null
                  : () => {
                      onReinstate?.(pinnedNode.el.id);
                      setPinned(null);
                    }
              }
            />
          )
        }
        containerStyle={{ width: "100%", height: "100%" }}
        overlay={
          <>
            <AddButtonsOverlay
              onAddEl={setAddingElType}
              onAddRel={() => {
                setAddingRelPrefill(null);
                setAddingRel(true);
              }}
              onAddArg={() => setAddingArg(true)}
              onAddGroup={() => onEditGroupRequest?.()}
              hideNonEntailsRels={hideNonEntailsRels}
            />
            <GroupChips
              hulls={hulls}
              groupNodes={groupNodes}
              positions={displayPositions}
              pan={pan}
              zoom={zoom}
              dims={dims}
              selectedId={selected}
              onToggle={(id) => onToggleGroup?.(id)}
              onEdit={(g) => onEditGroupRequest?.(g.id)}
              onUngroup={(id) => onUngroup?.(id)}
            />
            <CtrlSelectionBar
              selected={selected}
              ctrlArgNodes={ctrlArgNodes}
              asRelation={ctrlSelectionIsRelation}
              onGroup={() => {
                onCreateGroup?.([selected, ...ctrlArgNodes]);
                clearCtrlArg();
              }}
              onConfirm={() => {
                const all = [selected, ...ctrlArgNodes];
                if (ctrlSelectionIsRelation) {
                  setAddingRelPrefill({ from: all[0], to: all[1] });
                  setAddingRel(true);
                } else {
                  setAddingArgPrefill({
                    premises: all.slice(0, -1),
                    conclusion: all.at(-1),
                  });
                  setAddingArg(true);
                }
                clearCtrlArg();
              }}
              onCancel={clearCtrlArg}
            />
            <OffscreenIndicators
              els={displayEls}
              positions={displayPositions}
              pan={pan}
              zoom={zoom}
              dims={dims}
              color={C.dim}
            />
          </>
        }
      >
        {/* ── Group hulls ── */}
        {/* First, so they stay a backdrop: an outline drawn over the edges it
            surrounds would read as another relation. */}
        {hulls.map(({ group, box }) => (
          <GroupHull
            key={group.id}
            box={box}
            label={group.label}
            dimmed={!!highlightedIds}
          />
        ))}

        {/* ── Edges ── */}
        {soloRels.map((r) =>
          renderEdge(
            r,
            displayPositions,
            elementById,
            graphEdgeVisuals(r, wIds, dimEdge, selectedArgRelSet),
            edgeOffsets.get(r) ?? 0,
          ),
        )}
        {jointGroups.map((rels) => (
          <React.Fragment key={rels[0].argumentId}>
            {renderJointArgument(
              rels,
              displayPositions,
              elementById,
              graphEdgeVisuals(rels[0], wIds, dimEdge, selectedArgRelSet, rels),
            )}
          </React.Fragment>
        ))}

        {/* ── Nodes ── */}
        {displayEls.map((el) =>
          renderNode(
            el,
            displayPositions,
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
        setAddingRel={(v) => {
          if (!v) setAddingRelPrefill(null);
          setAddingRel(v);
        }}
        addingRelPrefill={addingRelPrefill}
        addingArg={addingArg}
        setAddingArg={(v) => {
          if (!v) setAddingArgPrefill(null);
          setAddingArg(v);
        }}
        addingArgPrefill={addingArgPrefill}
        linkableEls={linkableEls}
        round={state.round}
        onAddElement={onAddElement}
        onAddRelation={onAddRelation}
      />
    </>
  );
}
