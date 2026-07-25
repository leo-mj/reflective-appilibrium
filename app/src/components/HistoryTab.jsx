/**
 * @fileoverview Animated round-by-round history playback tab.
 * @module components/HistoryTab
 */

/** @import { REState, PositionMap } from '../types.js' */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { C } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { useAutoFit } from "../hooks/useAutoFit.js";
import { usePlayback } from "../hooks/usePlayback.js";
import { elementsAtRound, ARGUMENT_RELATION_TYPES } from "../utils/stateUtils.js";
import {
  GraphCanvas,
  OffscreenIndicators,
} from "./graphs_shared/GraphElements.jsx";
import { parallelEdgeOffsets, groupJointArguments } from "../utils/graphHelpers.js";
import {
  renderEdge,
  renderJointArgument,
  renderNode,
  historyEdgeVisuals,
  historyNodeVisuals,
} from "./graphs_shared/graphRender.jsx";

import { PlaybackControls } from "./history/HistoryPlaybackControls.jsx";
import { LogOverlay } from "./history/LogOverlay.jsx";

/**
 * Renders the History tab: animated, slider-controlled playback of the RE process
 * round by round.
 *
 * @param {Object}      props
 * @param {REState}     props.state
 * @param {PositionMap} props.positions
 * @param {function(number): void} props.onRoundChange - Notifies parent of the current round.
 * @param {boolean}     props.isWide
 * @returns {React.ReactElement}
 */
export function HistoryTab({ state, positions, onRoundChange, isWide, hideNonEntailsRels }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
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
  useAutoFit({ positions, dims, resetView, refitKey: state.elements.length });
  const playback = usePlayback(state.round);
  const { snappedRound } = playback;

  useEffect(() => {
    onRoundChange?.(snappedRound);
  }, [snappedRound, onRoundChange]);
  useEffect(() => {
    currentLogRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [snappedRound]);

  const elementById = useMemo(
    () => new Map(state.elements.map((e) => [e.id, e])),
    [state.elements],
  );

  const { withdrawn } = elementsAtRound(state.elements, snappedRound);
  const wIds = new Set(withdrawn.map((e) => e.id));
  const newIds = new Set(
    snappedRound > 0
      ? state.elements
          .filter((e) => e.addedRound === snappedRound)
          .map((e) => e.id)
      : [],
  );
  const sortedLog = [...state.log].sort((a, b) => a.round - b.round);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PlaybackControls playback={playback} maxRound={state.round} />

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
              els={state.elements}
              positions={positions}
              pan={pan}
              zoom={zoom}
              dims={dims}
              color={C.dim}
            />
          </>
        }
      >
        {(() => {
          const visRels = hideNonEntailsRels
            ? state.relations.filter((r) => ARGUMENT_RELATION_TYPES.has(r.type))
            : state.relations;
          const { solo, jointGroups } = groupJointArguments(visRels);
          const offsets = parallelEdgeOffsets(solo);
          return (
            <>
              {solo.map((r) =>
                renderEdge(
                  r,
                  positions,
                  elementById,
                  historyEdgeVisuals(r, wIds, snappedRound),
                  offsets.get(r) ?? 0,
                ),
              )}
              {jointGroups.map((rels) => (
                <React.Fragment key={rels[0].argumentId}>
                  {renderJointArgument(
                    rels,
                    positions,
                    elementById,
                    historyEdgeVisuals(rels[0], wIds, snappedRound, rels),
                  )}
                </React.Fragment>
              ))}
            </>
          );
        })()}
        {state.elements.map((el) =>
          renderNode(
            el,
            positions,
            historyNodeVisuals(el, wIds, newIds, snappedRound),
            isDragging,
            setTooltip,
          ),
        )}
      </GraphCanvas>
    </div>
  );
}
