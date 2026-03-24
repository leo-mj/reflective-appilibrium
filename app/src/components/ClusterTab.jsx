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
import { GraphCanvas } from "./GraphElements.jsx";
import {
  renderEdge,
  renderNode,
  graphEdgeVisuals,
  graphNodeVisuals,
} from "../utils/graphRender.jsx";
import { findCoherentClusters, clusterColor } from "../utils/clusterUtils.js";

// ─── ClusterGraph ─────────────────────────────────────────────────────────────

/**
 * Mini pannable graph showing only the elements of one cluster,
 * centred in whatever space the parent gives it.
 */
function ClusterGraph({ cluster, state, positions }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  const { pan, isDragging, onPointerDown, onPointerMove, onPointerUp } =
    usePan();

  const members = useMemo(() => new Set(cluster.members), [cluster]);
  const visibleEls = useMemo(
    () => state.elements.filter((e) => members.has(e.id)),
    [state.elements, members],
  );
  const ids = visibleEls.map((e) => e.id);

  // Translate nodes so their centroid sits at the canvas centre.
  const localPositions = useMemo(() => {
    const pts = ids.map((id) => positions[id]).filter(Boolean);
    if (!pts.length || !dims.w) return positions;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dx = dims.w / 2 - cx;
    const dy = dims.h / 2 - cy;
    const shifted = {};
    ids.forEach((id) => {
      if (positions[id])
        shifted[id] = { x: positions[id].x + dx, y: positions[id].y + dy };
    });
    return { ...positions, ...shifted };
  }, [positions, ids, dims]);

  const visRels = state.relations.filter(
    (r) => members.has(r.from) && members.has(r.to),
  );
  const wIds = new Set(
    state.elements.filter((e) => e.status === "withdrawn").map((e) => e.id),
  );

  return (
    <GraphCanvas
      containerRef={containerRef}
      dims={dims}
      pan={pan}
      isDragging={isDragging}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      tooltip={tooltip}
      containerStyle={{ width: "100%", height: "100%" }}
    >
      {visRels.map((r, i) =>
        renderEdge(
          r,
          i,
          localPositions,
          state.elements,
          graphEdgeVisuals(r, wIds, () => false, null),
        ),
      )}
      {visibleEls.map((el) =>
        renderNode(
          el,
          localPositions,
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
export function ClusterTab({ state, positions }) {
  const clusters = useMemo(() => findCoherentClusters(state), [state]);

  if (!clusters.length) {
    return (
      <div
        style={{
          padding: 24,
          color: C.dim,
          fontSize: 13,
          fontFamily: "system-ui, sans-serif",
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
          key={i}
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
            Cluster {i + 1} · {cluster.size} members
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ClusterGraph
              cluster={cluster}
              state={state}
              positions={positions}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
