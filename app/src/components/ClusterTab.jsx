/**
 * @fileoverview Cluster analysis tab — a grid of mini force-directed graphs,
 * one per coherent cluster. Text info lives in the TextTab cluster section.
 * @module components/ClusterTab
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useRef, useMemo } from "react";
import { C } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
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
import { findCoherentClusters, clusterColor } from "../utils/clusterUtils.js";
import { ARGUMENT_RELATION_TYPES } from "../utils/stateUtils.js";
import { useAutoFit } from "../hooks/useAutoFit.js";

// ─── ClusterGraph ─────────────────────────────────────────────────────────────

/**
 * Mini pannable graph showing only the elements of one cluster,
 * centred in whatever space the parent gives it.
 */
function ClusterGraph({
  cluster,
  color,
  state,
  positions,
  hideNonEntailsRels,
}) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  const {
    pan,
    zoom,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    applyWheel,
    zoomIn,
    zoomOut,
    resetView,
  } = usePan();

  const members = useMemo(() => new Set(cluster.members), [cluster]);
  const visibleEls = useMemo(
    () => state.elements.filter((e) => members.has(e.id)),
    [state.elements, members],
  );
  const ids = useMemo(() => visibleEls.map((e) => e.id), [visibleEls]);

  const memberKey = useMemo(
    () => [...cluster.members].sort().join(","),
    [cluster],
  );

  useAutoFit({
    positions,
    ids,
    dims,
    resetView,
    maxZoom: 0.8,
    refitKey: memberKey,
  });

  const elementById = useMemo(
    () => new Map(state.elements.map((e) => [e.id, e])),
    [state.elements],
  );
  const visRels = state.relations.filter(
    (r) =>
      members.has(r.from) &&
      members.has(r.to) &&
      (!hideNonEntailsRels || ARGUMENT_RELATION_TYPES.has(r.type)),
  );
  const wIds = new Set(
    state.elements.filter((e) => e.status === "withdrawn").map((e) => e.id),
  );

  return (
    <GraphCanvas
      containerRef={containerRef}
      dims={dims}
      pan={pan}
      zoom={zoom}
      isDragging={isDragging}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      applyWheel={applyWheel}
      zoomIn={zoomIn}
      zoomOut={zoomOut}
      tooltip={tooltip}
      containerStyle={{ width: "100%", height: "100%" }}
      overlay={
        <OffscreenIndicators
          els={visibleEls}
          positions={positions}
          pan={pan}
          zoom={zoom}
          dims={dims}
          color={color}
        />
      }
    >
      {visRels.map((r) =>
        renderEdge(
          r,
          positions,
          elementById,
          graphEdgeVisuals(r, wIds, () => false, null),
        ),
      )}
      {visibleEls.map((el) =>
        renderNode(
          el,
          positions,
          graphNodeVisuals(el, wIds, () => false, null),
          isDragging,
          setTooltip,
        ),
      )}
    </GraphCanvas>
  );
}

// ─── ClusterTab ───────────────────────────────────────────────────────────────

/**
 * Renders a 2-column grid of mini cluster graphs.
 * Cluster text info (members, tensions, merge candidates) lives in the TextTab.
 *
 * @param {Object}      props
 * @param {REState}     props.state
 * @param {PositionMap} props.positions
 */
export function ClusterTab({ state, positions, hideNonEntailsRels = false }) {
  const clusters = useMemo(
    () => findCoherentClusters(state, hideNonEntailsRels),
    [state, hideNonEntailsRels],
  );

  if (!clusters.length) {
    return (
      <div
        style={{
          padding: 24,
          color: C.dim,
          fontSize: 13,
        }}
      >
        No coherent clusters found. Add support relations between elements to
        form clusters.
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: 12,
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 10,
        alignContent: "start",
      }}
    >
      {clusters.map((cluster, i) => (
        <div
          key={[...cluster.members].sort().join(",")}
          style={{
            height: "100%",
            border: `1px solid ${clusterColor(i)}44`,
            borderRadius: 8,
            overflow: "hidden",
            background: C.panel,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: "bold",
              color: clusterColor(i),
              borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
            }}
          >
            Coherent cluster {i + 1} · {cluster.size} members
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ClusterGraph
              cluster={cluster}
              color={clusterColor(i)}
              state={state}
              positions={positions}
              hideNonEntailsRels={hideNonEntailsRels}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
