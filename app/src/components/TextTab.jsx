/**
 * @fileoverview Scrollable text panel showing the full RE state in readable form.
 * @module components/TextTab
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { scoreChanges, scorePerRound } from "../utils/simulateRethonClient.js";
import { RoundScoresChart } from "./graphs_shared/RoundScoresChart.jsx";
import { ARGUMENT_RELATION_TYPES } from "../utils/stateUtils.js";
import { BACKEND_ENABLED } from "../config.js";
import { C } from "../constants/colors.js";
import { useTextTabData } from "../hooks/useTextTabData.js";
import { useActiveSection } from "../hooks/useActiveSection.js";
import { Ctx } from "./text_panel/TextTabContext.js";
import {
  ArgumentCard,
  ElementCard,
  RelationCard,
  SectionHeader,
} from "./text_panel/TextTabCards.jsx";
import { HighlightedSection, SectionListing } from "./text_panel/TextTabSections.jsx";
import { ClusterSection } from "./text_panel/TextTabClusterSection.jsx";
import { NavBar } from "./text_panel/TextTabNavBar.jsx";
import { HistoryRoundBanner } from "./text_panel/TextTabPrimitives.jsx";
import { CoherenceSection } from "./text_panel/CoherenceSection.jsx";
import { LogSection } from "./text_panel/LogSection.jsx";
import { MobileAddButton } from "./text_panel/MobileAddButton.jsx";

// ─── Module-level constants ───────────────────────────────────────────────────

const DEFAULT_COLLAPSED_SECTIONS = {
  judgments: true,
  principles: true,
  theories: true,
  arguments: true,
  relations: true,
  coherence: true,
  clusters: true,
  log: true,
};

/**
 * Static nav config: keys and labels only. Counts/visibility computed at
 * runtime. `name` spells out the abbreviated labels for the accessible name —
 * "J" reads as the letter, which says nothing about where the pill goes.
 */
const NAV_SECTIONS = [
  { key: "judgments", label: "J", name: "judgments" },
  { key: "principles", label: "P", name: "principles" },
  { key: "theories", label: "T", name: "theories" },
  { key: "arguments", label: "Arguments" },
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
  onReinstate,
  onReinstateRel,
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
  showZScores = false,
  historyView = null,
}) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const scrollRef = useRef(null);
  const refJudgments = useRef(null);
  const refPrinciples = useRef(null);
  const refTheories = useRef(null);
  const refArguments = useRef(null);
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
              (e.type === "judgment" ||
                e.type === "principle" ||
                e.type === "theory"),
          )
          .map((e) => `${e.id}:${e.status}`),
        `rels:${
          state.relations.filter((r) => ARGUMENT_RELATION_TYPES.has(r.type))
            .length
        }`,
      ]
        .sort()
        .join(","),
    [state.elements, state.relations],
  );

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    scoreChanges(state, true, weights).then((result) => {
      if (cancelled || !result) return;
      setWithdrawalDeltas(
        Object.fromEntries(
          result.withdrawal_deltas.map((d) => [
            d.element_id,
            d.delta_account != null
              ? {
                  delta_account: d.delta_account,
                  delta_systematicity: d.delta_systematicity,
                }
              : null,
          ]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [withdrawalKey, weights]); // eslint-disable-line react-hooks/exhaustive-deps

  const [roundScores, setRoundScores] = useState(null);
  const [roundScoresLoading, setRoundScoresLoading] = useState(false);

  const loadRoundScores = () => {
    if (!BACKEND_ENABLED || roundScoresLoading) return;
    setRoundScoresLoading(true);
    scorePerRound(state)
      .then((data) => setRoundScores(data.round_scores))
      .catch(() => {})
      .finally(() => setRoundScoresLoading(false));
  };

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
    arguments: refArguments,
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
  // Split relations into argument groups (entails/precludes with a shared
  // argumentId) and plain relations, so each gets its own section + count.
  const argIds = new Set();
  let plainRelCount = 0;
  for (const r of displayRels) {
    if (ARGUMENT_RELATION_TYPES.has(r.type) && r.argumentId) argIds.add(r.argumentId);
    else plainRelCount++;
  }
  const argumentCount = argIds.size;
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
    // In "hide non-entails" mode the single relations section is relabeled
    // "Arguments"; the dedicated arguments nav entry only appears when all
    // relations are shown.
    arguments: {
      count: argumentCount,
      show: !highlightedIds && !hideNonEntailsRels && argumentCount > 0,
    },
    relations: {
      count: hideNonEntailsRels ? argumentCount + plainRelCount : plainRelCount,
      show:
        !highlightedIds &&
        (hideNonEntailsRels ? displayRels.length > 0 : plainRelCount > 0),
    },
    coherence: { count: null, show: !highlightedIds && hasCoherence },
    clusters: { count: clusterCount || null, show: clusterCount > 0 },
    log: { count: state.log.length || null, show: state.log.length > 0 },
  };
  const navItems = NAV_SECTIONS.map(({ key, label, name }) => ({
    key,
    label: key === "relations" && hideNonEntailsRels ? "Arguments" : label,
    name,
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
        onReinstate,
        onReinstateRel,
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
            isWide={isWide}
          />
        )}

        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <div
            ref={scrollRef}
            style={{
              overflowY: "auto",
              height: "100%",
              padding: "0 4px 24px",
              background: C.bg,
              color: C.text,
            }}
          >
            <HistoryRoundBanner historyView={historyView} />

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
                refArguments={refArguments}
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
        </div>

        {!isWide && (
          <MobileAddButton
            onAddElement={onAddElement}
            onAddRelation={onAddRelation}
            elements={state.elements}
            round={state.round}
          />
        )}

        {showZScores && (
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              padding: "6px 4px 2px",
              flexShrink: 0,
            }}
          >
            {roundScores ? (
              <RoundScoresChart
                roundScores={roundScores}
                snappedRound={state.round}
              />
            ) : (
              <button
                onClick={loadRoundScores}
                disabled={roundScoresLoading}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: roundScoresLoading ? C.dim : C.text,
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: roundScoresLoading ? "not-allowed" : "pointer",
                  width: "100%",
                }}
              >
                {roundScoresLoading ? "Calculating…" : "Calculate Z-scores per round"}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
