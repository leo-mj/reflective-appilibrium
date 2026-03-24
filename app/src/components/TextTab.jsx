/**
 * @fileoverview Scrollable text panel showing the full RE state in readable form.
 * @module components/TextTab
 */

/** @import { REState, RERelation } from '../types.js' */

import { useState, useRef, useEffect, useMemo } from "react";
import { C, getColors } from "../constants/colors.js";
import { getNeighbours } from "../utils/graphHelpers.js";
import { findCoherentClusters } from "../utils/clusterUtils.js";
import { buildPrincipleCovers, matchesSearch, matchesSearchRel } from "../utils/textTabHelpers.js";
import { CARD_STYLE } from "../constants/textTabStyles.js";
import { Ctx } from "./TextTabContext.js";
import {
  SectionHeader, CoherenceGroup,
  Highlight, HighlightedSection, SectionListing,
} from "./TextTabCards.jsx";
import { ClusterSection } from "./TextTabClusterSection.jsx";
import { AddPanel } from "./TextTabAddPanel.jsx";
import { NavBar } from "./TextTabNavBar.jsx";

// ─── Module-level constants ───────────────────────────────────────────────────

const DEFAULT_COLLAPSED_SECTIONS = {
  judgments: true, principles: true, theories: true,
  relations: true, coherence: true, clusters: false, log: true,
};

/** Static nav config: keys and labels only. Counts/visibility computed at runtime. */
const NAV_SECTIONS = [
  { key: "judgments",  label: "J" },
  { key: "principles", label: "P" },
  { key: "theories",   label: "T" },
  { key: "relations",  label: "Relations" },
  { key: "coherence",  label: "Coherence" },
  { key: "clusters",   label: "Clusters" },
  { key: "log",        label: "Log" },
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
 * @param {React.RefObject} props.clusterSectionRef
 */
export function TextTab({
  state, showWithdrawn, selected, onSelect, selectedRel, onSelectRel,
  onEditRequest, onEditRelRequest, onWithdrawRequest, onWithdrawRelRequest,
  onAddElement, onAddRelation, clusterSectionRef,
}) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const scrollRef      = useRef(null);
  const refJudgments   = useRef(null);
  const refPrinciples  = useRef(null);
  const refTheories    = useRef(null);
  const refRelations   = useRef(null);
  const refCoherence   = useRef(null);
  const refLog         = useRef(null);

  // ── State ───────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState("");
  const [collapsed,     setCollapsed]     = useState(DEFAULT_COLLAPSED_SECTIONS);
  const [activeSection, setActiveSection] = useState(null);
  const [addTab,        setAddTab]        = useState("element");

  const toggle      = (key) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const isCollapsed = (key) => (search ? false : !!collapsed[key]);

  const openAddElement = () => {
    setAddTab("element");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openAddRelation = () => {
    setAddTab("relation");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const visibleEls = showWithdrawn ? state.elements : state.elements.filter((e) => e.status !== "withdrawn");
  const visIds     = new Set(visibleEls.map((e) => e.id));
  const visRels    = state.relations.filter((r) => visIds.has(r.from) && visIds.has(r.to));
  const pCovers    = buildPrincipleCovers(visibleEls.filter((e) => e.type === "principle"), state.relations, visIds, state.elements);
  const badgeColor = (id) => {
    const el = state.elements.find((e) => e.id === id);
    return el ? getColors({ ...el, status: "active" }).stroke : C.dim;
  };

  const displayEls  = search ? visibleEls.filter((e) => matchesSearch(e, search)) : visibleEls;
  const displayRels = search ? visRels.filter((r) => matchesSearchRel(r, search)) : visRels;

  // ── Selection partitions ─────────────────────────────────────────────────
  const highlightedIds = selected
    ? getNeighbours(selected, visRels)
    : selectedRel ? new Set([selectedRel.from, selectedRel.to]) : null;

  const selectedEl   = selected ? (visibleEls.find((e) => e.id === selected) ?? null) : null;
  const neighbourEls = highlightedIds ? visibleEls.filter((e) => highlightedIds.has(e.id) && e.id !== selected) : [];
  const restEls      = highlightedIds ? visibleEls.filter((e) => !highlightedIds.has(e.id)) : visibleEls;
  const hlRels       = selected ? visRels.filter((r) => r.from === selected || r.to === selected)
                                : selectedRel ? [selectedRel] : [];
  const restRels     = selectedRel ? visRels.filter((r) => r !== selectedRel)
                                   : selected ? visRels.filter((r) => r.from !== selected && r.to !== selected)
                                   : visRels;

  const hasCoherence   = state.coherence.tensions.length > 0 || state.coherence.orphans.length > 0 || state.coherence.clusters.length > 0;
  const clusterCount   = useMemo(() => findCoherentClusters(state).length, [state]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const getSectionRef = (key) => ({
    judgments: refJudgments, principles: refPrinciples, theories: refTheories,
    relations: refRelations, coherence: refCoherence, clusters: clusterSectionRef, log: refLog,
  })[key];

  const navigateTo = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: false }));
    requestAnimationFrame(() => getSectionRef(key).current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const keys = ["judgments", "principles", "theories", "relations", "coherence", "clusters", "log"];
    const intersecting = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = keys.find((k) => getSectionRef(k).current === entry.target);
          if (!key) return;
          if (entry.isIntersecting) intersecting.add(key); else intersecting.delete(key);
        });
        const first = keys.find((k) => intersecting.has(k));
        if (first) setActiveSection(first);
      },
      { root: container, rootMargin: "-10px 0px -80% 0px", threshold: 0 },
    );
    let firstKey = null;
    keys.forEach((k) => {
      const el = getSectionRef(k).current;
      if (el) { observer.observe(el); if (!firstKey) firstKey = k; }
    });
    if (firstKey) requestAnimationFrame(() => setActiveSection(firstKey));
    return () => observer.disconnect();
  }, [selected, selectedRel]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectionMeta = {
    judgments:  { count: displayEls.filter((e) => e.type === "judgment").length,  show: !highlightedIds },
    principles: { count: displayEls.filter((e) => e.type === "principle").length, show: !highlightedIds },
    theories:   { count: displayEls.filter((e) => e.type === "theory").length,    show: !highlightedIds },
    relations:  { count: displayRels.length, show: !highlightedIds },
    coherence:  { count: null, show: !highlightedIds && hasCoherence },
    clusters:   { count: clusterCount || null, show: clusterCount > 0 },
    log:        { count: state.log.length || null, show: state.log.length > 0 },
  };
  const navItems = NAV_SECTIONS.map(({ key, label }) => ({ key, label, ...sectionMeta[key] })).filter((i) => i.show);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Ctx.Provider value={{ state, selected, onSelect, selectedRel, onSelectRel, onEditRequest, onEditRelRequest, onWithdrawRequest, onWithdrawRelRequest, badgeColor, pCovers, search }}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>

        <NavBar
          navItems={navItems}
          activeSection={activeSection}
          isCollapsed={isCollapsed}
          search={search}
          onSearch={setSearch}
          onNavigate={navigateTo}
        />

        <div ref={scrollRef} style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif" }}>

          <AddPanel
            activeTab={addTab}
            setActiveTab={setAddTab}
            elements={visibleEls.filter((e) => e.status !== "withdrawn")}
            onAddElement={onAddElement}
            onAddRelation={onAddRelation}
          />

          {highlightedIds && (
            <HighlightedSection
              selectedRel={selectedRel} selected={selected} selectedEl={selectedEl}
              neighbourEls={neighbourEls} hlRels={hlRels} restEls={restEls} restRels={restRels}
            />
          )}

          {!highlightedIds && (
            <SectionListing
              refJudgments={refJudgments} refPrinciples={refPrinciples} refTheories={refTheories} refRelations={refRelations}
              displayEls={displayEls}
              displayRels={displayRels}
              isCollapsed={isCollapsed}
              toggle={toggle}
              openAddElement={openAddElement}
              openAddRelation={openAddRelation}
            />
          )}

          {hasCoherence && (
            <div ref={refCoherence}>
              <SectionHeader title="Coherence" collapsed={isCollapsed("coherence")} onToggle={() => toggle("coherence")} />
              {!isCollapsed("coherence") && (
                <>
                  <CoherenceGroup title="Tensions" color={C.conflicts} items={state.coherence.tensions} />
                  <CoherenceGroup title="Orphans"  color={C.undermines} items={state.coherence.orphans} />
                  <CoherenceGroup title="Clusters" color={C.supports}   items={state.coherence.clusters} />
                </>
              )}
            </div>
          )}

          <ClusterSection
            state={state}
            clusterSectionRef={clusterSectionRef}
            collapsed={isCollapsed("clusters")}
            onToggle={() => toggle("clusters")}
          />

          {state.log.length > 0 && (
            <div ref={refLog}>
              <SectionHeader title="Round Log" collapsed={isCollapsed("log")} onToggle={() => toggle("log")} />
              {!isCollapsed("log") && state.log.map((l) => (
                <div key={l.round} style={{ ...CARD_STYLE, paddingBottom: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, marginBottom: 3 }}>Round {l.round}</div>
                  <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
                    <Highlight text={l.changes} query={search} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ position: "absolute", bottom: 10, left: 10, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, color: C.dim, cursor: "pointer", fontSize: 16, padding: "3px 8px" }}
        >↑ Top</button>

      </div>
    </Ctx.Provider>
  );
}
