/**
 * @fileoverview ClusterSection — collapsible cluster analysis section for TextTab.
 * @module components/TextTabClusterSection
 */

/** @import { REState } from '../../types.js' */

import { useContext, useMemo } from "react";
import { C, clusterColor, clusterTextColor } from "../../constants/colors.js";
import {
  findCrossClusterTensions,
  findMergeCandidates,
} from "../../utils/clusterUtils.js";
import { sortElementIds } from "../../utils/stateUtils.js";
import {
  CARD_STYLE,
  CONTENT_FONT_SIZE,
  CLUSTER_CARD_STYLE,
} from "../../constants/textTabStyles.js";
import { Ctx } from "./TextTabContext.js";
import { Badge, SectionHeader, Highlight } from "./TextTabCards.jsx";

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Array}    props.clusters - Pre-computed coherent clusters from the parent.
 * @param {React.RefObject} props.clusterSectionRef
 * @param {boolean}  props.collapsed
 * @param {function} props.onToggle
 */
export function ClusterSection({
  state,
  clusters,
  clusterSectionRef,
  collapsed,
  onToggle,
}) {
  const tensions = useMemo(
    () => findCrossClusterTensions(clusters, state),
    [clusters, state],
  );
  const merges = useMemo(
    () => findMergeCandidates(clusters, state),
    [clusters, state],
  );
  const { badgeColor, search } = useContext(Ctx);

  if (!clusters.length) return null;

  return (
    <div ref={clusterSectionRef}>
      <SectionHeader
        title={`Clusters (${clusters.length})`}
        collapsed={collapsed}
        onToggle={onToggle}
      />

      {!collapsed &&
        clusters.map((cluster, i) => {
          const color = clusterColor(i);
          const members = [...cluster.members].sort(sortElementIds);
          return (
            <div key={members.join(",")} style={{ ...CARD_STYLE }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: "bold",
                    padding: "1px 7px",
                    borderRadius: 4,
                    // Tint the chip with the cluster's fill, but write the
                    // label in the text tone — the fills are fixed hues and
                    // most of them fail AA as type on one theme or the other.
                    background: color + "22",
                    color: clusterTextColor(i),
                    border: `1px solid ${color}55`,
                  }}
                >
                  Cluster {i + 1}
                </span>
                <span style={{ fontSize: 11, color: C.dim }}>
                  {cluster.size} members
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {members.map((id) => {
                  const el = state.elements.find((e) => e.id === id);
                  return (
                    <div
                      key={id}
                      style={{
                        ...CLUSTER_CARD_STYLE,
                        minWidth: 0,
                      }}
                    >
                      <Badge id={id} />
                      <Highlight text={el.text} query={search} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {!collapsed && tensions.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: "bold",
              letterSpacing: 1,
              textTransform: "uppercase",
              color: C.conflicts,
              marginBottom: 6,
            }}
          >
            Cross-cluster tensions
          </div>
          {tensions.map((t) => (
            <div
              key={`${t.edge.from}-${t.edge.to}-${t.edge.type}-${t.clusterIndices.join("-")}`}
              style={{
                fontSize: CONTENT_FONT_SIZE,
                color: C.dim,
                marginBottom: 6,
                lineHeight: 1.5,
                paddingLeft: 8,
                borderLeft: `2px solid ${C.conflicts}55`,
              }}
            >
              <span
                style={{ color: badgeColor(t.edge.from), fontWeight: "bold" }}
              >
                {t.edge.from}
              </span>{" "}
              <span style={{ color: C.conflicts }}>{t.edge.type}</span>{" "}
              <span
                style={{ color: badgeColor(t.edge.to), fontWeight: "bold" }}
              >
                {t.edge.to}
              </span>{" "}
              (Cluster {t.clusterIndices[0] + 1} ↔ Cluster{" "}
              {t.clusterIndices[1] + 1})
            </div>
          ))}
        </>
      )}

      {!collapsed && merges.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: "bold",
              letterSpacing: 1,
              textTransform: "uppercase",
              color: C.supports,
              marginBottom: 6,
              marginTop: 8,
            }}
          >
            Merge candidates
          </div>
          {merges.map((m) => (
            <div
              key={m.clusterIndices.join("-")}
              style={{
                fontSize: CONTENT_FONT_SIZE,
                color: C.dim,
                marginBottom: 6,
                lineHeight: 1.5,
                paddingLeft: 8,
                borderLeft: `2px solid ${C.supports}55`,
              }}
            >
              Cluster {m.clusterIndices[0] + 1} + Cluster{" "}
              {m.clusterIndices[1] + 1} →{" "}
              {m.conflictsToResolve.length === 0
                ? "ready to merge"
                : `resolve ${m.conflictsToResolve.length} conflict(s)`}{" "}
              (merged size: {m.mergedSize}
              {m.wouldBeClean ? ", would be clean" : ""})
            </div>
          ))}
        </>
      )}
    </div>
  );
}
