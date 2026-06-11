/**
 * @fileoverview Scrollable text panel showing the full RE state in readable form.
 * @module components/TextTab
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { scoreChanges } from "../utils/simulateRethonClient.js";
import { C } from "../constants/colors.js";
import { useTextTabData } from "../hooks/useTextTabData.js";
import { useActiveSection } from "../hooks/useActiveSection.js";
import { Ctx } from "./text_panel/TextTabContext.js";
import {
  ArgumentCard,
  ElementCard,
  RelationCard,
  SectionHeader,
  HighlightedSection,
  SectionListing,
} from "./text_panel/TextTabCards.jsx";
import { ClusterSection } from "./text_panel/TextTabClusterSection.jsx";
import { NavBar } from "./text_panel/TextTabNavBar.jsx";
import { CoherenceSection } from "./text_panel/CoherenceSection.jsx";
import { LogSection } from "./text_panel/LogSection.jsx";
import { MobileAddButton } from "./text_panel/MobileAddButton.jsx";

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
  // { key: "coherence", label: "Coherence" },
  { key: "clusters", label: "Clusters" },
  { key: "log", label: "Log" },
];

// ─── TextTab ──────────────────────────────────────────────────────────────────

/** Scrollable text panel rendering the full RE state as structured prose. */
export function TextTab({
  state,
  hiddenLegendKeys,
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
  scrollToRelationsKey,
  showTabNav,
  recentlyAdded,
  recentlyAddedRel,
  expandAllKey,
  allExpanded,
  hideNonEntailsRels,
  weights,
}) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const scrollRef = useRef(null);
  const refJudgments = useRef(null);
  const refPrinciples = useRef(null);
  const refTheories = useRef(null);
  const refRelations = useRef(null);
  const refCoherence = useRef(null);
  const refLog = useRef(null);

  // ── State ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(DEFAULT_COLLAPSED_SECTIONS);
  /**
   * @type {[Record<string,{delta_account:number,delta_systematicity:number}|null>|null, Function]}
   * null = not yet computed
   */
  const [withdrawalDeltas, setWithdrawalDeltas] = useState(null);

  // Recompute withdrawal deltas whenever active/revised J/P/T elements or
  // their argument relations change. Stable string key avoids spurious fires.
  const withdrawalKey = useMemo(
    () =>
      [
        ...state.elements
          .filter(
            (e) =>
              (e.status === "active" || e.status === "revised") &&
              (e.type === "judgment" || e.type === "principle" || e.type === "theory"),
          )
          .map((e) => `${e.id}:${e.status}`),
        `rels:${
          state.relations.filter(
            (r) =>
              r.type === "entails" || r.type === "precludes" || r.type === "jointly_entails" || r.type === "jointly_precludes",
          ).length
        }`,
      ]
        .sort()
        .join(","),
    [state.elements, state.relations],
  );

  useEffect(() => {
    let cancelled = false;
    scoreChanges(state, true, weights).then((result) => {
      if (cancelled || !result) return;
      setWithdrawalDeltas(
        Object.fromEntries(
          result.withdrawal_deltas.map((d) => [
            d.element_id,
            d.delta_account != null
              ? { delta_account: d.delta_account, delta_systematicity: d.delta_systematicity }
              : null,
          ]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [withdrawalKey, weights]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const isCollapsed = (key) => (search ? false : !!collapsed[key]);

  useEffect(() => {
    if (expandAllKey > 0)
      requestAnimationFrame(() =>
        setCollapsed(
          Object.fromEntries(
            Object.keys(DEFAULT_COLLAPSED_SECTIONS).map((k) => [
              k,
              !allExpanded,
            ]),
          ),
        ),
      );
  }, [expandAllKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ─────────────────────────────────────────────────────────
  const {
    pCovers,
    badgeColor,
    displayEls,
    displayRels,
    highlightedIds,
    selectedEl,
    neighbourEls,
    restEls,
    hlRels,
    restRels,
    hasCoherence,
    clusters,
    clusterCount,
    pinnedEl,
    pinnedRel,
    pinnedArgRels,
  } = useTextTabData({
    state,
    hiddenLegendKeys,
    selected,
    selectedRel,
    recentlyAdded,
    recentlyAddedRel,
    search,
  });

  // ── Navigation ───────────────────────────────────────────────────────────
  const sectionRefs = {
    judgments: refJudgments,
    principles: refPrinciples,
    theories: refTheories,
    relations: refRelations,
    coherence: refCoherence,
    clusters: clusterSectionRef,
    log: refLog,
  };

  const navigateTo = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: false }));
    requestAnimationFrame(() =>
      sectionRefs[key].current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };

  useEffect(() => {
    if (scrollToRelationsKey > 0)
      requestAnimationFrame(() => navigateTo("relations"));
  }, [scrollToRelationsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSection = useActiveSection(sectionRefs, scrollRef, [
    selected,
    selectedRel,
    clusterCount,
    state.log.length,
  ]);

  // ── Nav bar items ─────────────────────────────────────────────────────────
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
    relations: {
      count: displayRels.length,
      show: !highlightedIds && (!hideNonEntailsRels || displayRels.length > 0),
    },
    coherence: { count: null, show: !highlightedIds && hasCoherence },
    clusters: { count: clusterCount || null, show: clusterCount > 0 },
    log: { count: state.log.length || null, show: state.log.length > 0 },
  };
  const navItems = NAV_SECTIONS.map(({ key, label }) => ({
    key,
    label: key === "relations" && hideNonEntailsRels ? "Arguments" : label,
    ...sectionMeta[key],
  })).filter((i) => i.show);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Ctx.Provider
      value={{
        state,
        selected,
        onSelect: isWide ? onSelect : () => {},
        selectedRel,
        onSelectRel: isWide ? onSelectRel : () => {},
        onEditRequest,
        onEditRelRequest,
        onWithdrawRequest,
        onWithdrawRelRequest,
        badgeColor,
        pCovers,
        search,
        withdrawalDeltas,
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
        {showTabNav && (
          <NavBar
            navItems={navItems}
            activeSection={activeSection}
            isCollapsed={isCollapsed}
            search={search}
            onSearch={setSearch}
            onNavigate={navigateTo}
          />
        )}

        <div
          ref={scrollRef}
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "0 4px 24px",
            background: C.bg,
            color: C.text,
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

          {!highlightedIds && (pinnedEl || pinnedRel) && (
            <>
              <SectionHeader title="Just added" />
              {pinnedEl && <ElementCard e={pinnedEl} />}
              {pinnedRel &&
                (pinnedArgRels ? (
                  <ArgumentCard rels={pinnedArgRels} />
                ) : (
                  <RelationCard
                    key={`${pinnedRel.from}-${pinnedRel.to}-${pinnedRel.type}-${pinnedRel.addedRound ?? 1}`}
                    r={pinnedRel}
                  />
                ))}
              <div
                style={{
                  borderTop: `1px solid ${C.border}`,
                  margin: "4px 0 8px",
                }}
              />
            </>
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
              showRelations={!hideNonEntailsRels}
            />
          )}

          {/* {hasCoherence && (
            <CoherenceSection
              state={state}
              sectionRef={refCoherence}
              isCollapsed={isCollapsed("coherence")}
              onToggle={() => toggle("coherence")}
            />
          )} */}

          <ClusterSection
            state={state}
            clusters={clusters}
            clusterSectionRef={clusterSectionRef}
            collapsed={isCollapsed("clusters")}
            onToggle={() => toggle("clusters")}
          />

          {state.log.length > 0 && (
            <LogSection
              log={state.log}
              sectionRef={refLog}
              isCollapsed={isCollapsed("log")}
              onToggle={() => toggle("log")}
              search={search}
            />
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
          <MobileAddButton
            onAddElement={onAddElement}
            onAddRelation={onAddRelation}
            elements={state.elements}
            round={state.round}
          />
        )}
      </div>
    </Ctx.Provider>
  );
}
