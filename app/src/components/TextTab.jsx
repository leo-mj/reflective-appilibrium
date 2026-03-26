/**
 * @fileoverview Scrollable text panel showing the full RE state in readable form.
 * @module components/TextTab
 */

/** @import { REState, RERelation } from '../types.js' */

import { useState, useRef, useEffect, useMemo } from "react";
import { C, getColors } from "../constants/colors.js";
import { getNeighbours } from "../utils/graphHelpers.js";
import { findCoherentClusters } from "../utils/clusterUtils.js";
import {
  buildPrincipleCovers,
  matchesSearch,
  matchesSearchRel,
} from "../utils/textTabHelpers.js";
import { CARD_STYLE } from "../constants/textTabStyles.js";
import { Ctx } from "./text_panel/TextTabContext.js";
import {
  SectionHeader,
  CoherenceGroup,
  Highlight,
  HighlightedSection,
  SectionListing,
} from "./text_panel/TextTabCards.jsx";
import { ClusterSection } from "./text_panel/TextTabClusterSection.jsx";
import { NavBar } from "./text_panel/TextTabNavBar.jsx";
import { AddElementModal } from "./user_edits/AddElementModal.jsx";
import { AddRelationModal } from "./user_edits/AddRelationModal.jsx";

// ─── Module-level constants ───────────────────────────────────────────────────

const DEFAULT_COLLAPSED_SECTIONS = {
  judgments: true,
  principles: true,
  theories: true,
  relations: true,
  coherence: true,
  clusters: false,
  log: true,
};

/** Static nav config: keys and labels only. Counts/visibility computed at runtime. */
const NAV_SECTIONS = [
  { key: "judgments", label: "J" },
  { key: "principles", label: "P" },
  { key: "theories", label: "T" },
  { key: "relations", label: "Relations" },
  { key: "coherence", label: "Coherence" },
  { key: "clusters", label: "Clusters" },
  { key: "log", label: "Log" },
];

// ─── TextTab ──────────────────────────────────────────────────────────────────

/**
 * Scrollable text panel that renders the full RE state as structured, styled prose.
 *
 * @param {Object}          props
 * @param {REState}         props.state
 * @param {boolean}         props.showWithdrawn
 * @param {string|null}     props.selected
 * @param {function}        props.onSelect
 * @param {RERelation|null} props.selectedRel
 * @param {function}        props.onSelectRel
 * @param {function}        props.onEditRequest
 * @param {function}        props.onEditRelRequest
 * @param {function}        props.onWithdrawRequest
 * @param {function}        props.onWithdrawRelRequest
 * @param {function}        props.onAddElement
 * @param {function}        props.onAddRelation
 * @param {boolean}         props.isWide
 * @param {React.RefObject} props.clusterSectionRef
 */
export function TextTab({
  state,
  showWithdrawn,
  selected,
  onSelect,
  selectedRel,
  onSelectRel,
  onEditRequest,
  onEditRelRequest,
  onWithdrawRequest,
  onWithdrawRelRequest,
  onAddElement,
  onAddRelation,
  isWide,
  clusterSectionRef,
}) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const scrollRef = useRef(null);

  // ── Mobile add menu/modal ─────────────────────────────────────────────────
  const [addMenu, setAddMenu] = useState(false);
  const [adding, setAdding] = useState(null); // 'element' | 'relation' | null
  const refJudgments = useRef(null);
  const refPrinciples = useRef(null);
  const refTheories = useRef(null);
  const refRelations = useRef(null);
  const refCoherence = useRef(null);
  const refLog = useRef(null);

  // ── State ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(DEFAULT_COLLAPSED_SECTIONS);
  const [activeSection, setActiveSection] = useState(null);

  const toggle = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const isCollapsed = (key) => (search ? false : !!collapsed[key]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const visibleEls = showWithdrawn
    ? state.elements
    : state.elements.filter((e) => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map((e) => e.id));
  const visRels = state.relations.filter(
    (r) => visIds.has(r.from) && visIds.has(r.to),
  );
  const pCovers = buildPrincipleCovers(
    visibleEls.filter((e) => e.type === "principle"),
    state.relations,
    visIds,
    state.elements,
  );
  const colorById = useMemo(
    () =>
      new Map(
        state.elements.map((e) => [
          e.id,
          getColors({ ...e, status: "active" }).stroke,
        ]),
      ),
    [state.elements],
  );
  const badgeColor = (id) => colorById.get(id) ?? C.dim;

  const displayEls = search
    ? visibleEls.filter((e) => matchesSearch(e, search))
    : visibleEls;
  const displayRels = search
    ? visRels.filter((r) => matchesSearchRel(r, search))
    : visRels;

  // ── Selection partitions ─────────────────────────────────────────────────
  let highlightedIds = null;
  if (selected) highlightedIds = getNeighbours(selected, visRels);
  else if (selectedRel)
    highlightedIds = new Set([selectedRel.from, selectedRel.to]);

  const selectedEl = selected
    ? (visibleEls.find((e) => e.id === selected) ?? null)
    : null;
  const neighbourEls = highlightedIds
    ? visibleEls.filter((e) => highlightedIds.has(e.id) && e.id !== selected)
    : [];
  const restEls = highlightedIds
    ? visibleEls.filter((e) => !highlightedIds.has(e.id))
    : visibleEls;

  let hlRels = [];
  if (selected)
    hlRels = visRels.filter((r) => r.from === selected || r.to === selected);
  else if (selectedRel) hlRels = [selectedRel];

  let restRels = visRels;
  if (selectedRel) restRels = visRels.filter((r) => r !== selectedRel);
  else if (selected)
    restRels = visRels.filter((r) => r.from !== selected && r.to !== selected);

  const hasCoherence =
    state.coherence.tensions.length > 0 ||
    state.coherence.orphans.length > 0 ||
    state.coherence.clusters.length > 0;
  const clusters = useMemo(() => findCoherentClusters(state), [state]);
  const clusterCount = clusters.length;

  // ── Navigation ───────────────────────────────────────────────────────────
  const getSectionRef = (key) =>
    ({
      judgments: refJudgments,
      principles: refPrinciples,
      theories: refTheories,
      relations: refRelations,
      coherence: refCoherence,
      clusters: clusterSectionRef,
      log: refLog,
    })[key];

  const navigateTo = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: false }));
    requestAnimationFrame(() =>
      getSectionRef(key).current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const keys = [
      "judgments",
      "principles",
      "theories",
      "relations",
      "coherence",
      "clusters",
      "log",
    ];
    const intersecting = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = keys.find(
            (k) => getSectionRef(k).current === entry.target,
          );
          if (!key) return;
          if (entry.isIntersecting) intersecting.add(key);
          else intersecting.delete(key);
        });
        const first = keys.find((k) => intersecting.has(k));
        if (first) setActiveSection(first);
      },
      { root: container, rootMargin: "-10px 0px -80% 0px", threshold: 0 },
    );
    let firstKey = null;
    keys.forEach((k) => {
      const el = getSectionRef(k).current;
      if (el) {
        observer.observe(el);
        if (!firstKey) firstKey = k;
      }
    });
    if (firstKey) requestAnimationFrame(() => setActiveSection(firstKey));
    return () => observer.disconnect();
  }, [selected, selectedRel, clusterCount, state.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectionMeta = {
    judgments: {
      count: displayEls.filter((e) => e.type === "judgment").length,
      show: !highlightedIds,
    },
    principles: {
      count: displayEls.filter((e) => e.type === "principle").length,
      show: !highlightedIds,
    },
    theories: {
      count: displayEls.filter((e) => e.type === "theory").length,
      show: !highlightedIds,
    },
    relations: { count: displayRels.length, show: !highlightedIds },
    coherence: { count: null, show: !highlightedIds && hasCoherence },
    clusters: { count: clusterCount || null, show: clusterCount > 0 },
    log: { count: state.log.length || null, show: state.log.length > 0 },
  };
  const navItems = NAV_SECTIONS.map(({ key, label }) => ({
    key,
    label,
    ...sectionMeta[key],
  })).filter((i) => i.show);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Ctx.Provider
      value={{
        state,
        selected,
        onSelect,
        selectedRel,
        onSelectRel,
        onEditRequest,
        onEditRelRequest,
        onWithdrawRequest,
        onWithdrawRelRequest,
        badgeColor,
        pCovers,
        search,
      }}
    >
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <NavBar
          navItems={navItems}
          activeSection={activeSection}
          isCollapsed={isCollapsed}
          search={search}
          onSearch={setSearch}
          onNavigate={navigateTo}
        />

        <div
          ref={scrollRef}
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "0 4px 24px",
            background: C.bg,
            color: C.text,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {highlightedIds && (
            <HighlightedSection
              selectedRel={selectedRel}
              selected={selected}
              selectedEl={selectedEl}
              neighbourEls={neighbourEls}
              hlRels={hlRels}
              restEls={restEls}
              restRels={restRels}
            />
          )}

          {!highlightedIds && (
            <SectionListing
              refJudgments={refJudgments}
              refPrinciples={refPrinciples}
              refTheories={refTheories}
              refRelations={refRelations}
              displayEls={displayEls}
              displayRels={displayRels}
              isCollapsed={isCollapsed}
              toggle={toggle}
            />
          )}

          {hasCoherence && (
            <div ref={refCoherence}>
              <SectionHeader
                title="Coherence"
                collapsed={isCollapsed("coherence")}
                onToggle={() => toggle("coherence")}
              />
              {!isCollapsed("coherence") && (
                <>
                  <CoherenceGroup
                    title="Tensions"
                    color={C.conflicts}
                    items={state.coherence.tensions}
                  />
                  <CoherenceGroup
                    title="Orphans"
                    color={C.undermines}
                    items={state.coherence.orphans}
                  />
                  <CoherenceGroup
                    title="Clusters"
                    color={C.supports}
                    items={state.coherence.clusters}
                  />
                </>
              )}
            </div>
          )}

          <ClusterSection
            state={state}
            clusters={clusters}
            clusterSectionRef={clusterSectionRef}
            collapsed={isCollapsed("clusters")}
            onToggle={() => toggle("clusters")}
          />

          {state.log.length > 0 && (
            <div ref={refLog}>
              <SectionHeader
                title="Round Log"
                collapsed={isCollapsed("log")}
                onToggle={() => toggle("log")}
              />
              {!isCollapsed("log") &&
                state.log.map((l) => (
                  <div
                    key={l.round}
                    style={{
                      ...CARD_STYLE,
                      paddingBottom: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: C.text,
                        marginBottom: 3,
                      }}
                    >
                      Round {l.round}
                    </div>
                    <div
                      style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}
                    >
                      <Highlight text={l.changes} query={search} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <button
          onClick={() =>
            scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
          }
          style={{
            zIndex: 99,
            position: "absolute",
            bottom: 10,
            left: 10,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.dim,
            cursor: "pointer",
            fontSize: 16,
            padding: "3px 8px",
          }}
        >
          ↑ Top
        </button>

        {!isWide && (
          <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 99 }}>
            {addMenu && (
              <div
                style={{
                  position: "absolute",
                  bottom: 44,
                  right: 0,
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {[["element", "Element"], ["relation", "Relation"]].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setAdding(key); setAddMenu(false); }}
                    style={{
                      background: "transparent",
                      border: "none",
                      borderBottom: key === "element" ? `1px solid ${C.border}` : "none",
                      color: C.text,
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "10px 18px",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setAddMenu((m) => !m)}
              style={{
                background: C.supports,
                border: "none",
                borderRadius: 6,
                color: "#fff",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>
        )}

        {adding === "element" && (
          <AddElementModal
            initialType="judgment"
            currentRound={state.round}
            onSave={(formData) => { onAddElement(formData); setAdding(null); }}
            onCancel={() => setAdding(null)}
          />
        )}

        {adding === "relation" && (
          <AddRelationModal
            elements={state.elements.filter((e) => e.status !== "withdrawn")}
            currentRound={state.round}
            onSave={(formData) => { onAddRelation(formData); setAdding(null); }}
            onCancel={() => setAdding(null)}
          />
        )}
      </div>
    </Ctx.Provider>
  );
}
