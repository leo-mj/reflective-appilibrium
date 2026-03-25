/**
 * @fileoverview ClusterSection — collapsible cluster analysis section for TextTab.
 * @module components/TextTabClusterSection
 */

/** @import { REState } from '../../types.js' */

import { useContext, useMemo } from "react";
import { C } from "../../constants/colors.js";
import {
  findCrossClusterTensions,
  findMergeCandidates,
  clusterColor,
} from "../../utils/clusterUtils.js";
import { sortElementIds } from "../../utils/stateUtils.js";
import {
  CARD_STYLE,
  CONTENT_FONT_SIZE,
} from "../../constants/textTabStyles.js";
import { Ctx } from "./TextTabContext.js";
import { SectionHeader, Highlight } from "./TextTabCards.jsx";

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
            <div key={i} style={{ ...CARD_STYLE }}>
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
                    background: color + "22",
                    color,
                    border: `1px solid ${color}55`,
                  }}
                >
                  Cluster {i + 1}
                </span>
                <span style={{ fontSize: 11, color: C.dim }}>
                  {cluster.size} members
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {members.map((id) => {
                  const el = state.elements.find((e) => e.id === id);
                  return (
                    <span
                      key={id}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: "bold",
                          padding: "1px 7px",
                          borderRadius: 4,
                          background: badgeColor(id) + "22",
                          color: badgeColor(id),
                          border: `1px solid ${badgeColor(id)}55`,
                        }}
                      >
                        {id}
                      </span>
                      {el && (
                        <span
                          style={{
                            fontSize: CONTENT_FONT_SIZE,
                            color: C.dim,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Highlight text={el.text} query={search} />
                        </span>
                      )}
                    </span>
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
              fontSize: 11,
              fontWeight: "bold",
              letterSpacing: 1,
              textTransform: "uppercase",
              color: C.conflicts,
              marginBottom: 6,
            }}
          >
            Cross-cluster tensions
          </div>
          {tensions.map((t, i) => (
            <div
              key={i}
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
              fontSize: 10,
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
          {merges.map((m, i) => (
            <div
              key={i}
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
