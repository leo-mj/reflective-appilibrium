/**
 * @fileoverview Cluster analysis tab — a grid of mini force-directed graphs,
 * one per coherent cluster. Text info lives in the TextTab cluster section.
 * @module components/ClusterTab
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useRef, useMemo, useEffect } from "react";
import { C } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { GraphCanvas, OffscreenIndicators } from "./GraphElements.jsx";
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
// Padding around the bounding box (accounts for node radius + label).
const FIT_PADDING = 120;

function ClusterGraph({ cluster, color, state, positions }) {
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
  const ids = visibleEls.map((e) => e.id);

  // Stable key for the cluster membership — triggers re-fit when members change.
  const memberKey = useMemo(
    () => [...cluster.members].sort().join(","),
    [cluster],
  );

  // Auto-fit: compute zoom + pan so all nodes are visible, then snap the view.
  useEffect(() => {
    if (!dims.w) return;
    const pts = ids.map((id) => positions[id]).filter(Boolean);
    if (!pts.length) return;
    const xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs),
      x1 = Math.max(...xs);
    const y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    const bboxW = x1 - x0,
      bboxH = y1 - y0;
    const fitZoom =
      bboxW < 10 && bboxH < 10
        ? 1
        : Math.min(
            (dims.w - FIT_PADDING) / bboxW,
            (dims.h - FIT_PADDING) / bboxH,
            0.8,
          );
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    resetView(
      { x: dims.w / 2 - cx * fitZoom, y: dims.h / 2 - cy * fitZoom },
      fitZoom,
    );
  }, [dims.w, dims.h, memberKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {visRels.map((r, i) =>
        renderEdge(
          r,
          i,
          positions,
          state.elements,
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
              color={clusterColor(i)}
              state={state}
              positions={positions}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
