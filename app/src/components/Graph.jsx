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

import { C } from "../constants/colors.js";
import { usePalette } from "../hooks/useTheme.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { useAutoFit } from "../hooks/useAutoFit.js";
import { useGraphClick } from "../hooks/useGraphClick.js";
import { useStatementView } from "../hooks/useStatementView.js";
import { useCardGrowth } from "../hooks/useCardGrowth.js";
import { useShownRelation } from "../hooks/useShownRelation.js";
import { usePanGlide } from "../hooks/useViewGlide.js";
import { pageFontFamily } from "../utils/textWidth.js";
import { drawnOnGraph, graphHighlights } from "../utils/graphView.js";
import {
  elementRadius,
  fitView,
  focusFraming,
  parallelEdgeOffsets,
  groupJointArguments,
} from "../utils/graphHelpers.js";
import { groupsOf, projectGroups } from "../utils/groupUtils.js";
import { processesOf, processTagMap } from "../utils/mergeStates.js";
import { linkableElements } from "../utils/stateUtils.js";
import { STATEMENT_SPREAD } from "../utils/statementCards.js";
import {
  GraphCanvas,
  GroupHull,
  CardBackgrounds,
  RelationLabel,
  OffscreenIndicators,
  StatementToggle,
} from "./graphs_shared/GraphElements.jsx";
import { GroupChips } from "./graphs_shared/GroupChips.jsx";
import {
  renderEdge,
  renderJointArgument,
  renderNode,
  graphEdgeVisuals,
  graphNodeVisuals,
} from "./graphs_shared/graphRender.jsx";
import { ActionButtons } from "./text_panel/TextTabPrimitives.jsx";
import { AddButtonsOverlay } from "./graph/AddButtonsOverlay.jsx";
import { CtrlSelectionBar } from "./graph/CtrlSelectionBar.jsx";
import { GraphModals } from "./graph/GraphModals.jsx";

// ─── Subcomponents ────────────────────────────────────────────────────────────

/**
 * How far inside the canvas's edge, in screen px, a selected node's centre has
 * to be to count as on screen. At the very edge it is half cut off.
 */
const ON_SCREEN_MARGIN = 24;

/**
 * How much of the canvas's right edge its controls cover — the add buttons'
 * column (`AddButtonsOverlay`, about 76px wide at 12px in) with the margin
 * above beside it. A node under them is not one the reader can see.
 */
const RIGHT_CONTROLS_WIDTH = 96 + ON_SCREEN_MARGIN;

/**
 * The elements a relation joins: its two ends, or for one step of a joint
 * argument, every premise of that argument and its conclusion.
 *
 * @param {import('../types.js').RERelation} rel
 * @param {import('../types.js').RERelation[]} relations
 * @returns {string[]}
 */
const relationEnds = (rel, relations) => {
  const rels = rel.argumentId
    ? relations.filter((r) => r.argumentId === rel.argumentId)
    : [rel];
  return [...new Set(rels.flatMap((r) => [r.from, r.to]))];
};

/** Withdrawn and rejected elements offer Reinstate where others offer Withdraw. */
const isInPlay = (el) => el.status !== "withdrawn" && el.status !== "rejected";

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
 * - **Pan** — drag the background via {@link module:hooks/usePan}.
 * - **Move a node** — drag it with a mouse (`nodeDrag`, from
 *   {@link module:hooks/useStablePositions}). It stays where it is dropped,
 *   for as long as the page is open. A finger on a node still pans.
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
 * @param {function}    [props.onCtrlChainSelect] - Called with the whole ctrl+click
 *   chain — `[selected, ...the ones ctrl-clicked since]` — every time it grows.
 *   The add bar fills its link forms from it, so the premises it is holding are
 *   the ones {@link CtrlSelectionBar} is naming, read the same way round: the
 *   last is the conclusion and the rest are the premises.
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
  positions: layoutPositions,
  nodeDrag,
  selected,
  onSelect,
  selectedRel,
  onSelectRel,
  onAddElement,
  onAddRelation,
  onEditRequest,
  onWithdrawRequest,
  onReinstate,
  onCtrlChainSelect,
  onCreateGroup,
  onToggleGroup,
  onEditGroupRequest,
  onUngroup,
  ready,
  recentlyAdded,
  hideNonEntailsRels,
  equilibriumPreviewWithdrawnIds,
  focus,
  search = "",
}) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  // Needed here for the joint-argument renderer, which is a plain function and
  // so cannot hook for itself.
  const palette = usePalette();
  const [tooltip, setTooltip] = useState(null);
  // Clicking a node pins its tooltip open with the same actions the text tab
  // offers. It takes precedence over the hover tooltip until dismissed.
  const [pinned, setPinned] = useState(null);
  // It is opened by a click that selects, and goes when the selection does —
  // Escape included, which clears the selection from outside the canvas.
  if (pinned && !selected) setPinned(null);
  // The edge under the pointer, or last tapped, whose explanation shows.
  const [shownRel, showRel] = useShownRelation();
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

  // What is drawn: see `utils/graphView.js`.
  const { visibleEls, visRels, wIds } = drawnOnGraph(
    state,
    hiddenLegendKeys,
    equilibriumPreviewWithdrawnIds,
  );
  // After a merge, which process each node came from. Empty otherwise.
  const processTags = useMemo(() => processTagMap(processesOf(state)), [state]);
  // What the add modals may reference. Deliberately not narrowed by the legend:
  // hiding withdrawn nodes to declutter the canvas should not also remove them
  // from the pickers.
  const linkableEls = linkableElements(state.elements);

  // ── Pan, and the statement view ───────────────────────────────────────────
  // Ahead of the groups, since the statement view decides what they are drawn
  // from: display copies carrying a card each, at positions made room for.

  const {
    pan,
    zoom,
    isDragging,
    onPointerDown: panDown,
    onPointerMove,
    onPointerUp: panUp,
    applyWheel,
    zoomIn,
    zoomOut,
    resetView,
  } = usePan();
  // A node being moved by hand. Held apart from `isDragging`, which is the
  // view's pan, but it silences the same hover responses.
  const [draggingNode, setDraggingNode] = useState(false);
  const moving = isDragging || draggingNode;
  const { statements, toggleStatements, drawnEls, positions, measure } =
    useStatementView({
      layoutPositions,
      visibleEls,
      visRels,
      groups: groupsOf(state),
      dims,
      resetView,
      pan,
      zoom,
      // Carried across the others while held, rather than shoving each one it
      // meets aside; the cards settle once it is let go.
      holding: draggingNode,
    });
  const growth = useCardGrowth({ measure, isDragging: moving });

  // ── Groups ────────────────────────────────────────────────────────────────
  // Everything below this point works on the *projected* graph: a collapsed
  // group is one node, its internal edges are gone, and every edge that crossed
  // its boundary now runs to the group. Projecting after the visibility filter
  // rather than before it is what keeps the two consistent — a group whose
  // members the legend has hidden has nothing left to stand for.
  const {
    elements: projectedEls,
    relations: displayRels,
    relSource,
    positions: projectedPositions,
    hulls,
    groupNodes,
  } = projectGroups({
    elements: drawnEls,
    relations: visRels,
    groups: groupsOf(state),
    positions,
    // A hull pads by one number on both axes; a card's half-width covers it
    // sideways and leaves some room over and under.
    radiusOf: (e) => e?.card?.hw ?? elementRadius(e),
  });
  // The hovered — or, on a phone, tapped — card grown to its whole statement;
  // see `hooks/useCardGrowth.js`. Everything below draws and hit-tests these.
  const {
    elements: displayEls,
    positions: displayPositions,
    overlay,
  } = growth.grow(projectedEls, projectedPositions);

  /** The relation as held in state — see `relSource` in utils/groupUtils. */
  const toSourceRel = (r) => relSource.get(r) ?? r;
  const groupIds = new Set(groupNodes.map((g) => g.id));

  const stateElementById = useMemo(
    () => new Map(state.elements.map((e) => [e.id, e])),
    [state.elements],
  );

  // What lights up and what fades: see `utils/graphView.js`.
  const query = search.trim();
  const { highlightedIds, selectedArgRelSet, dimNode, dimEdge } = graphHighlights({
    groups: groupsOf(state),
    selected,
    selectedRel,
    ctrlArgNodes,
    displayEls,
    displayRels,
    toSourceRel,
    query,
    elementById: stateElementById,
  });

  // What is drawn goes over what is held: edge geometry and hit-testing look
  // their endpoints up in this map, so a collapsed group has to be in it, and
  // so do the statement view's enlarged copies.
  const elementById = new Map(stateElementById);
  for (const e of displayEls) elementById.set(e.id, e);

  const { solo: soloRels, jointGroups } = groupJointArguments(displayRels);
  const edgeOffsets = parallelEdgeOffsets(soloRels);

  // ── Click ─────────────────────────────────────────────────────────────────

  // The raw positions, not the projected ones: a collapsed group's members keep
  // theirs, so framing still covers the ground the group is standing on — and
  // the tour, below, can frame an element that is currently inside one.
  useAutoFit({ positions, dims, resetView, enabled: ready });

  const focusKey = focus?.key;

  // What is selected is brought into view, at the zoom the reader has: an
  // element, or a relation's ends — every premise and the conclusion, for a
  // joint argument, since the whole argument is what lights up. Picked in the
  // text panel, most often; a click on the canvas selects what is already on
  // it, and moves the view only when that is cut off at the edge.
  const { glideTo, stop: stopGlide } = usePanGlide({ resetView, pan, zoom });
  const seenFocus = useRef(focusKey);
  const seenSelection = useRef({ selected, selectedRel });
  useEffect(() => {
    // A change of selection only: on arrival — back from History with
    // something selected — the opening fit has the view, and this effect
    // would be reading it from before that fit landed.
    const seen = seenSelection.current;
    if (seen.selected === selected && seen.selectedRel === selectedRel) return;
    seenSelection.current = { selected, selectedRel };
    // The tour selects and frames together, and its framing is the one that
    // counts: a selection arriving in the same render as one does not glide.
    if (focusKey !== seenFocus.current || !dims.w) return;
    const ids = selected
      ? [selected]
      : selectedRel
        ? relationEnds(selectedRel, state.relations)
        : [];

    // Every end's whole box on screen, not its centre: a statement card is
    // wide, and one standing half off the edge had its centre well inside.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const pos = displayPositions[id] ?? positions[id];
      if (!pos) continue;
      const el = displayEls.find((e) => e.id === id);
      const rx = (el?.card?.hw ?? (el ? elementRadius(el) : 0)) * zoom;
      const ry = (el?.card?.hh ?? (el ? elementRadius(el) : 0)) * zoom;
      const sx = pos.x * zoom + pan.x;
      const sy = pos.y * zoom + pan.y;
      minX = Math.min(minX, sx - rx);
      maxX = Math.max(maxX, sx + rx);
      minY = Math.min(minY, sy - ry);
      maxY = Math.max(maxY, sy + ry);
    }
    if (minX === Infinity) return;

    // What is clear of the canvas's own controls: the add buttons and the
    // zoom column run down the right edge, and a node under them is hidden.
    const left = ON_SCREEN_MARGIN;
    const top = ON_SCREEN_MARGIN;
    const right = dims.w - RIGHT_CONTROLS_WIDTH;
    const bottom = dims.h - ON_SCREEN_MARGIN;
    const lost = maxX < 0 || minX > dims.w || maxY < 0 || minY > dims.h;
    const fits = maxX - minX <= right - left && maxY - minY <= bottom - top;
    let dx;
    let dy;
    if (lost || !fits) {
      // Nowhere to be seen, or too big to show whole: centred on the clear area.
      dx = (left + right) / 2 - (minX + maxX) / 2;
      dy = (top + bottom) / 2 - (minY + maxY) / 2;
    } else {
      // Only cut off: moved just far enough to be whole, so the rest of the
      // view — which the reader was looking at — shifts as little as it can.
      dx = minX < left ? left - minX : maxX > right ? right - maxX : 0;
      dy = minY < top ? top - minY : maxY > bottom ? bottom - maxY : 0;
    }
    if (!dx && !dy) return;
    // The card a click pins is placed in page coordinates, where the click
    // was; it moves with the view, or it would be left behind by the node it
    // is about.
    glideTo({ x: pan.x + dx, y: pan.y + dy }, (mx, my) =>
      setPinned((p) => p && { ...p, x: p.x + mx, y: p.y + my }),
    );
    // Keyed on the selection alone: the view moving is not a reason to move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedRel]);

  // The tour re-frames the graph on the elements the section being read names.
  // Keyed on `focus.key` rather than on the ids, so the same section framed
  // again — scrolled back to, or reached after the panel resized — still fits.
  // `positions` is deliberately not a dependency: this fires when the tour
  // moves on, not on every tick of the simulation.
  useEffect(() => {
    seenFocus.current = focusKey;
    if (!focusKey) return;
    stopGlide();
    const view = fitView(
      positions,
      focus.ids ?? null,
      dims,
      // A named set is framed as tightly as this canvas can stand; the whole
      // graph takes fitView's own defaults.
      focus.ids ? focusFraming(dims) : { padding: 96, maxZoom: 1 },
    );
    if (view) resetView(view.pan, view.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, dims.w, dims.h, ready]);

  // What a dragged node moves: a collapsed group's disc stands for its members,
  // and a node in a ctrl+click selection brings the rest of the selection with
  // it — the selection holds together and keeps its shape. The chain holds no
  // groups (`onCtrlNodeClick` refuses them), so it needs no expanding.
  const dragIdsOf = (el) => {
    if (el.type === "group")
      return groupsOf(state).find((g) => g.id === el.id)?.members ?? [];
    const chain = ctrlArgNodes.length ? [selected, ...ctrlArgNodes] : [];
    return chain.includes(el.id) ? chain : [el.id];
  };

  const {
    onPointerDown,
    onPointerMove: pointerMove,
    onPointerUp,
    onPointerCancel: pointerCancel,
    nodeAt,
    relationAt,
    toSim,
  } = useGraphClick({
    panDown,
    panUp,
    panMove: onPointerMove,
    onNodeDragStart: nodeDrag
      ? (el) => {
          setDraggingNode(true);
          setPinned(null);
          nodeDrag.grab(dragIdsOf(el));
        }
      : undefined,
    // The statement view draws the layout spread about its centre, so a card
    // moved some distance on screen is a node moved that much less.
    onNodeDrag: (_el, dx, dy) => {
      const k = statements ? STATEMENT_SPREAD : 1;
      nodeDrag?.moveTo(dx / k, dy / k);
    },
    onNodeDragEnd: () => {
      setDraggingNode(false);
      nodeDrag?.release();
    },
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
    overlay,
    // A tap grows a card as hover does; see `useCardGrowth`.
    onTap: (el, rel) => {
      growth.tap(el);
      showRel(rel);
    },
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
        // The whole chain rather than the node just added, so the add bar can
        // hold what the chip is naming: three ctrl-clicks make a three-premise
        // argument on the canvas, and the bar showing one premise and the last
        // conclusion was a second, quieter reading of the same click.
        // `ctrlArgNodes` is already the list for *this* `selected` — the guard
        // above is what makes that so — hence the new chain without waiting for
        // the state it was just handed.
        onCtrlChainSelect?.([selected, ...ctrlArgNodes, id]);
      } else if (!selected) {
        onSelectRel(() => null);
        onSelect((prev) => (prev === id ? null : id));
      }
    },
  });

  /**
   * Frames the whole graph, as the view opened — the way back after panning
   * away, or after dragging nodes out to the edges. The raw positions, as for
   * the opening fit, so a collapsed group's ground is framed too.
   */
  const fitGraph = () => {
    stopGlide();
    const view = fitView(positions, null, dims, { padding: 96, maxZoom: 1 });
    if (view) resetView(view.pan, view.zoom);
  };

  // A wheel taking the view over mid-glide keeps it, as a pointer does.
  const wheel = useCallback(
    (deltaY, mx, my) => {
      stopGlide();
      applyWheel(deltaY, mx, my);
    },
    [applyWheel, stopGlide],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  // A relation is binary, so it is only on offer for a two-node selection, and
  // only where non-argument relations are visible at all.
  const ctrlSelectionIsRelation =
    !hideNonEntailsRels && ctrlArgNodes.length === 1;

  // A pinned card outlives the click that opened it, so it has to let go when
  // the node underneath stops being drawn — expanding a group from its chip
  // dissolves exactly the node whose members the card is listing.
  // Once per node: a statement card's background, drawn under the edges, has
  // to fade exactly as the rest of the card does.
  const nodeVisuals = new Map(
    displayEls.map((el) => [
      el.id,
      graphNodeVisuals(
        el,
        wIds,
        dimNode,
        selected,
        undefined,
        recentlyAdded,
        equilibriumPreviewWithdrawnIds,
      ),
    ]),
  );

  const pinnedNode =
    pinned && displayEls.some((e) => e.id === pinned.el.id) ? pinned : null;

  return (
    <>
      <GraphCanvas
        containerRef={containerRef}
        dims={dims}
        pan={pan}
        zoom={zoom}
        isDragging={moving}
        onPointerDown={(e) => {
          // A pointer taking the view over mid-glide keeps it.
          stopGlide();
          growth.notePointer(e);
          onPointerDown(e);
        }}
        onPointerMove={(e) => {
          growth.notePointer(e);
          pointerMove(e);
          // A mouse over an edge shows what it says; over a node, or panning,
          // nothing. A finger has `onTap` instead.
          if (e.pointerType !== "mouse") return;
          if (moving) return showRel(null);
          const { sx, sy } = toSim(e);
          showRel(nodeAt(sx, sy) ? null : relationAt(sx, sy));
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") showRel(null);
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={pointerCancel}
        applyWheel={wheel}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        onFit={fitGraph}
        // On a node, Revise; on the background, fit. An edge takes neither: its
        // two clicks select it and let it go, which is what they were for.
        onDoubleClick={(e) => {
          if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
          const { sx, sy } = toSim(e);
          const el = nodeAt(sx, sy);
          if (el) {
            // Not a group: its first click has already opened it.
            if (el.type === "group") return;
            // The two clicks before this selected the node and let it go
            // again; it is what the dialog is about, so it is held once more,
            // and stays held when the dialog closes. The card they pinned is
            // shut — the dialog stands in for it.
            setPinned(null);
            onSelect(() => el.id);
            onEditRequest?.(el.id);
            return;
          }
          if (!relationAt(sx, sy)) fitGraph();
        }}
        viewControls={
          <StatementToggle on={statements} onToggle={toggleStatements} />
        }
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

        {/* ── Card backgrounds ── */}
        {/* Under the edges, so that one running behind a statement card is
            still drawn; the card's outline and text go on top with the nodes. */}
        <CardBackgrounds
          elements={displayEls}
          positions={displayPositions}
          visualsOf={(el) => nodeVisuals.get(el.id)}
        />

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
              palette,
            )}
          </React.Fragment>
        ))}

        {/* ── Nodes ── */}
        {displayEls.map((el) =>
          renderNode(
            el,
            displayPositions,
            {
              ...nodeVisuals.get(el.id),
              processTag: processTags.get(el.id),
              // For the card to mark what the search found in its wording.
              search: query,
            },
            moving,
            setTooltip,
            // A card's hover grows it rather than opening the hover card over
            // it: the wording is the card, and a second box repeating it was
            // the clutter. The details the hover card also carried are on the
            // one a click pins, beside Revise and Withdraw.
            growth.hoverFor(el),
          ),
        )}
        {/* ── What the edge under the pointer says, over everything ── */}
        {/* Only while the edge is still drawn: one deleted, or hidden by the
            legend, under a pointer that has not moved since, says nothing. */}
        {shownRel && displayRels.includes(shownRel.rel) && (
          <RelationLabel
            hit={shownRel}
            zoom={zoom}
            color={
              shownRel.rel.status === "withdrawn"
                ? C.withdrawn
                : palette.edges[shownRel.rel.type]
            }
            fontFamily={pageFontFamily()}
          />
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
