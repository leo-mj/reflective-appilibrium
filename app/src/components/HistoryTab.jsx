/**
 * @fileoverview Animated history playback, step by step or round by round.
 * @module components/HistoryTab
 */

/** @import { REState, PositionMap } from '../types.js' */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { C } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { useAutoFit } from "../hooks/useAutoFit.js";
import { usePlayback } from "../hooks/usePlayback.js";
import { usePalette } from "../hooks/useTheme.js";
import {
  elementsAtRound,
  asOfRound,
  ARGUMENT_RELATION_TYPES,
  roundStops,
} from "../utils/stateUtils.js";
import {
  CardBackgrounds,
  GraphCanvas,
  RelationLabel,
  OffscreenIndicators,
  StatementToggle,
} from "./graphs_shared/GraphElements.jsx";
import { useStatementView } from "../hooks/useStatementView.js";
import { cardAt, useCardGrowth } from "../hooks/useCardGrowth.js";
import { useShownRelation } from "../hooks/useShownRelation.js";
import { widestCard } from "../utils/statementCards.js";
import {
  fitView,
  parallelEdgeOffsets,
  groupJointArguments,
  relationAt,
} from "../utils/graphHelpers.js";
import { pageFontFamily } from "../utils/textWidth.js";
import {
  renderEdge,
  renderJointArgument,
  renderNode,
  historyEdgeVisuals,
  historyNodeVisuals,
} from "./graphs_shared/graphRender.jsx";

import { processesOf, processTagMap } from "../utils/mergeStates.js";
import { PlaybackControls } from "./history/HistoryPlaybackControls.jsx";
import { LogOverlay } from "./history/LogOverlay.jsx";

/**
 * The steps the slider stops at, one per notch: every step, or the end of each
 * round and the latest step.
 *
 * @param {REState} state
 * @param {"step"|"round"} unit
 * @returns {number[]}
 */
function stopsOf(state, unit) {
  return unit === "round"
    ? roundStops(state)
    : Array.from({ length: state.round + 1 }, (_, i) => i);
}

/**
 * Renders the History tab: animated, slider-controlled playback of the RE process.
 *
 * It moves by step — one per change, exact — or by round, stopping at the end
 * of each (stateUtils, "Steps and rounds"). Either way what it plays is a
 * step: `snappedRound` below is always one, whichever unit the slider counts.
 *
 * @param {Object}      props
 * @param {REState}     props.state
 * @param {PositionMap} props.positions
 * @param {function(number): void} props.onRoundChange - Notifies parent of the
 *   step being played.
 * @param {"step"|"round"} [props.unit] - What the slider moves by.
 * @param {function("step"|"round"): void} [props.onUnitChange]
 * @param {boolean}     props.isWide
 * @returns {React.ReactElement}
 */
export function HistoryTab({
  state,
  positions,
  onRoundChange,
  isWide,
  hideNonEntailsRels,
  unit = "step",
  onUnitChange,
}) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  // For the joint-argument renderer, which is a plain function and cannot hook.
  const palette = usePalette();
  const [tooltip, setTooltip] = useState(null);
  const logRef = useRef();
  const currentLogRef = useRef();

  const {
    pan,
    zoom,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    applyWheel,
    zoomIn,
    zoomOut,
    resetView,
  } = usePan();
  const stops = useMemo(() => stopsOf(state, unit), [state, unit]);
  const playback = usePlayback(stops.length - 1);
  // The step being played, whatever the slider counts in.
  const snappedRound = stops[Math.min(playback.snappedRound, stops.length - 1)];

  // A change of unit keeps the place: the notch at or before the step on
  // screen, so switching never shows a round not yet reached.
  const changeUnit = (next) => {
    if (next === unit) return;
    const nextStops = stopsOf(state, next);
    let index = 0;
    nextStops.forEach((step, i) => {
      if (step <= snappedRound) index = i;
    });
    onUnitChange?.(next);
    playback.jumpTo(index);
  };

  useEffect(() => {
    onRoundChange?.(snappedRound);
  }, [snappedRound, onRoundChange]);
  useEffect(() => {
    currentLogRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [snappedRound]);

  // Projected back to the round being played, so hover tooltips show the status,
  // wording and withdrawal reason that were in force then rather than now.
  const elementsNow = useMemo(
    () => state.elements.map((e) => asOfRound(e, snappedRound)),
    [state.elements, snappedRound],
  );

  const visRels = hideNonEntailsRels
    ? state.relations.filter((r) => ARGUMENT_RELATION_TYPES.has(r.type))
    : state.relations;

  // The statement view, as on the Graph tab and by the same switch: each
  // element a card, carrying the wording it had in the round being played, so
  // playback shows statements being revised. Laid out at each card's largest
  // wording over the whole process (`widestCard`), so the layout holds still
  // through playback rather than being pushed about at every revision.
  const stateById = useMemo(
    () => new Map(state.elements.map((e) => [e.id, e])),
    [state.elements],
  );
  const {
    statements,
    toggleStatements,
    drawnEls,
    positions: viewPositions,
    measure,
  } = useStatementView({
    layoutPositions: positions,
    visibleEls: elementsNow,
    visRels,
    groups: [],
    dims,
    resetView,
    pan,
    zoom,
    layoutCardOf: (e, m) => widestCard(stateById.get(e.id) ?? e, m),
  });
  const growth = useCardGrowth({ measure, isDragging });
  const {
    elements: displayEls,
    positions: displayPositions,
    overlay,
  } = growth.grow(drawnEls, viewPositions);
  // Not yet added at this round: drawn, faded to nothing, so that it fades in
  // when its round comes — and so not something a pointer can grow.
  const inPlay = (e) => (e.addedRound || 1) <= snappedRound;

  // A tap, on a phone: grows the card tapped, as it does on the Graph tab.
  // This canvas has no click handling of its own, so it spots taps here.
  const tapFrom = useRef(null);

  const elementById = new Map(displayEls.map((e) => [e.id, e]));

  const { withdrawn } = elementsAtRound(state.elements, snappedRound);
  const wIds = new Set(withdrawn.map((e) => e.id));
  // Only the processes merged by the round being played: before the first
  // merge there is one process and nothing to tell apart.
  const processTags = useMemo(
    () => processTagMap(processesOf(state, snappedRound)),
    [state, snappedRound],
  );
  const newIds = new Set(
    snappedRound > 0
      ? state.elements
          .filter((e) => e.addedRound === snappedRound)
          .map((e) => e.id)
      : [],
  );
  const sortedLog = [...state.log].sort((a, b) => a.round - b.round);
  useAutoFit({
    positions: viewPositions,
    dims,
    resetView,
    refitKey: state.elements.length,
  });

  /** Frames the whole graph again, as it opened — the Graph tab's fit button. */
  const fitHistory = () => {
    const view = fitView(viewPositions, null, dims, {
      padding: 96,
      maxZoom: 1,
    });
    if (view) resetView(view.pan, view.zoom);
  };

  const { solo, jointGroups } = groupJointArguments(visRels);
  const offsets = parallelEdgeOffsets(solo);

  // What an edge says, shown under a mouse or a tap as on the Graph tab — by
  // the same hit test (`relationAt`), in the wording the round being played
  // gave it. Not for a relation not yet added, drawn invisible.
  const relInPlay = (r) => (r.addedRound || 1) <= snappedRound;
  /** `{ sx, sy }` in simulation coordinates, from a pointer event. */
  const simAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      sx: (e.clientX - rect.left - pan.x) / zoom,
      sy: (e.clientY - rect.top - pan.y) / zoom,
    };
  };
  /** The node or card at a point, and failing one, the edge. */
  const pointedAt = ({ sx, sy }) => {
    const el = cardAt(
      displayEls.filter(inPlay),
      displayPositions,
      overlay,
      sx,
      sy,
    );
    return {
      el,
      rel: el
        ? null
        : relationAt(
            {
              relations: solo.filter(relInPlay),
              jointGroups: jointGroups.filter((g) => relInPlay(g[0])),
              positions: displayPositions,
              elementById,
              edgeOffsets: offsets,
            },
            sx,
            sy,
          ),
    };
  };
  const [shownRel, showRel] = useShownRelation();
  const shown =
    shownRel && visRels.includes(shownRel.rel) && relInPlay(shownRel.rel)
      ? {
          ...shownRel,
          rels: shownRel.rels.map((r) => asOfRound(r, snappedRound)),
        }
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PlaybackControls
        playback={playback}
        maxRound={stops.length - 1}
        unit={unit}
        onUnitChange={onUnitChange ? changeUnit : null}
        step={snappedRound}
        maxStep={state.round}
      />

      <GraphCanvas
        roundEnds={state.roundEnds}
        containerRef={containerRef}
        dims={dims}
        pan={pan}
        zoom={zoom}
        isDragging={isDragging}
        onPointerDown={(e) => {
          growth.notePointer(e);
          tapFrom.current = { x: e.clientX, y: e.clientY, type: e.pointerType };
          onPointerDown(e);
        }}
        onPointerMove={(e) => {
          growth.notePointer(e);
          onPointerMove(e);
          if (e.pointerType !== "mouse") return;
          if (isDragging) return showRel(null);
          showRel(pointedAt(simAt(e)).rel);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") showRel(null);
        }}
        onPointerUp={(e) => {
          onPointerUp(e);
          const from = tapFrom.current;
          tapFrom.current = null;
          if (from?.type !== "touch") return;
          if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10) return;
          const { el, rel } = pointedAt(simAt(e));
          // A tap grows a card, or shows what an edge says, and a tap on open
          // canvas lets either go.
          if (statements) growth.tap(el);
          showRel(rel);
        }}
        onPointerCancel={onPointerCancel}
        applyWheel={applyWheel}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        onFit={fitHistory}
        // The background only, as on the Graph tab.
        onDoubleClick={(e) => {
          if (e.button !== 0) return;
          const { el, rel } = pointedAt(simAt(e));
          if (!el && !rel) fitHistory();
        }}
        viewControls={
          <StatementToggle on={statements} onToggle={toggleStatements} />
        }
        tooltip={tooltip}
        containerStyle={{ flex: 1, minHeight: 0 }}
        overlay={
          <>
            {isWide && (
              <LogOverlay
                sortedLog={sortedLog}
                snappedRound={snappedRound}
                logRef={logRef}
                currentLogRef={currentLogRef}
              />
            )}
            <OffscreenIndicators
              els={displayEls.filter(inPlay)}
              positions={displayPositions}
              pan={pan}
              zoom={zoom}
              dims={dims}
              color={C.dim}
            />
          </>
        }
      >
        {/* Card fills under the edges, as on the Graph tab. */}
        <CardBackgrounds
          elements={displayEls}
          positions={displayPositions}
          visualsOf={(el) => historyNodeVisuals(el, wIds, newIds, snappedRound)}
        />
        {(() => {
          return (
            <>
              {solo.map((r) =>
                renderEdge(
                  r,
                  displayPositions,
                  elementById,
                  historyEdgeVisuals(r, wIds, snappedRound),
                  offsets.get(r) ?? 0,
                ),
              )}
              {jointGroups.map((rels) => (
                <React.Fragment key={rels[0].argumentId}>
                  {renderJointArgument(
                    rels,
                    displayPositions,
                    elementById,
                    historyEdgeVisuals(rels[0], wIds, snappedRound, rels),
                    palette,
                  )}
                </React.Fragment>
              ))}
            </>
          );
        })()}
        {displayEls.map((el) =>
          renderNode(
            el,
            displayPositions,
            {
              ...historyNodeVisuals(el, wIds, newIds, snappedRound),
              processTag: processTags.get(el.id),
            },
            isDragging,
            setTooltip,
            // A card grows under the pointer instead of opening the hover card
            // — and one not yet added, drawn invisible, answers nothing.
            el.card ? (inPlay(el) ? growth.hoverFor(el) : {}) : undefined,
          ),
        )}

        {/* What the edge under the pointer says, over everything. */}
        {shown && (
          <RelationLabel
            hit={shown}
            zoom={zoom}
            color={
              historyEdgeVisuals(shown.rel, wIds, snappedRound, shown.rels)
                .isWithdrawn
                ? C.withdrawn
                : palette.edges[shown.rel.type]
            }
            fontFamily={pageFontFamily()}
          />
        )}
      </GraphCanvas>
    </div>
  );
}
