/**
 * @fileoverview High-level layout orchestrators for the TextTab.
 * HighlightedSection renders the focused-selection view;
 * SectionListing renders the full J/P/T/Relations breakdown.
 * @module components/TextTabSections
 */

import { useState } from "react";
import { sortElementIds } from "../../utils/stateUtils.js";
import { C } from "../../constants/colors.js";
import { GHOST_BTN_STYLE } from "../../constants/textTabStyles.js";
import { SectionHeader } from "./TextTabPrimitives.jsx";
import { groupRelationsByArgument } from "./textPanelUtils.js";
import {
  ElementCard,
  ElementCards,
  ArgumentCard,
  RelationCard,
} from "./TextTabCards.jsx";

// ─── Sort toggle ──────────────────────────────────────────────────────────────

function SortToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
      {["element", "added"].map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="tap-target"
          style={{
            ...GHOST_BTN_STYLE,
            fontSize: 10,
            padding: "1px 6px",
            letterSpacing: 0.5,
            // Weight and ink carry the selection, not opacity. At 10px, fading
            // the unselected one to 0.6 put it at 3.31:1 on the dark ground and
            // 2.36:1 on the light one — under AA on both, and the light theme
            // fails at every opacity below 1.
            fontWeight: value === opt ? "bold" : "normal",
            color: value === opt ? C.text : C.dim,
            textTransform: "none",
          }}
        >
          {opt === "element" ? "by element" : "by date"}
        </button>
      ))}
    </div>
  );
}

function sortEls(els, sort) {
  return [...els].sort((a, b) =>
    sort === "added"
      ? (a.addedRound ?? 1) - (b.addedRound ?? 1)
      : sortElementIds(a.id, b.id),
  );
}

// ─── Highlighted selection section ────────────────────────────────────────────

export function HighlightedSection({
  selectedRel,
  selected,
  selectedEls,
  selectedGroup,
  neighbourEls,
  hlRels,
  restEls,
  restRels,
}) {
  return (
    <>
      {selectedRel ? (
        selectedRel.argumentId ? (
          <>
            <SectionHeader title="Argument" />
            <ArgumentCard rels={hlRels.length > 0 ? hlRels : [selectedRel]} />
          </>
        ) : (
          <>
            <SectionHeader title={`${selectedRel.from} → ${selectedRel.to}`} />
            <RelationCard r={selectedRel} />
            {neighbourEls.length > 0 && <SectionHeader title="Elements" />}
            <ElementCards els={neighbourEls} />
          </>
        )
      ) : (
        <>
          {/* A group's name, not its id: "G1" is an internal handle, and the
              members below are the only thing that makes the heading mean
              anything. For an element the id *is* what it is called. */}
          <SectionHeader
            title={
              selectedGroup
                ? `${selectedGroup.label} (${selectedGroup.members.length})`
                : selected
            }
          />
          <ElementCards els={selectedEls} />
          {neighbourEls.length > 0 && <SectionHeader title="Neighbours" />}
          <ElementCards els={neighbourEls} />
          {hlRels.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  letterSpacing: 1.5,
                  color: C.dim,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Relations
              </div>
              {groupRelationsByArgument(hlRels).map((group) =>
                group.argId ? (
                  <ArgumentCard key={group.argId} rels={group.rels} />
                ) : (
                  <RelationCard
                    key={`${group.rels[0].from}-${group.rels[0].to}-${group.rels[0].type}-${group.rels[0].addedRound ?? 1}`}
                    r={group.rels[0]}
                  />
                ),
              )}
            </>
          )}
        </>
      )}
      <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0 0" }} />
      <SectionHeader title="All elements" />
      <ElementCards els={restEls} dim />
      {groupRelationsByArgument(restRels).map((group) =>
        group.argId ? (
          <ArgumentCard key={group.argId} rels={group.rels} dim />
        ) : (
          <RelationCard
            key={`${group.rels[0].from}-${group.rels[0].to}-${group.rels[0].type}-${group.rels[0].addedRound ?? 1}`}
            r={group.rels[0]}
            dim
          />
        ),
      )}
    </>
  );
}

// ─── Section listing (J / P / T / Rel) ───────────────────────────────────────

export function SectionListing({
  refJudgments,
  refPrinciples,
  refTheories,
  refArguments,
  refRelations,
  displayEls,
  displayRels,
  isCollapsed,
  toggle,
  showRelations = true,
}) {
  const [judgmentSort, setJudgmentSort] = useState("element");
  const [principleSort, setPrincipleSort] = useState("element");
  const [theorySort, setTheorySort] = useState("element");
  const [relSort, setRelSort] = useState("element");
  const byType = (type) => displayEls.filter((e) => e.type === type);
  const sortedRels = [...displayRels].sort((a, b) =>
    relSort === "added"
      ? (a.addedRound ?? 1) - (b.addedRound ?? 1)
      : sortElementIds(a.from, b.from),
  );
  const relGroups = groupRelationsByArgument(sortedRels);
  const argGroups = relGroups.filter((g) => g.argId);
  const plainRelGroups = relGroups.filter((g) => !g.argId);
  const relKey = (group) =>
    `${group.rels[0].from}-${group.rels[0].to}-${group.rels[0].type}-${group.rels[0].addedRound ?? 1}`;
  return (
    <>
      <div ref={refJudgments}>
        <SectionHeader
          title={`Judgments (${byType("judgment").length})`}
          collapsed={isCollapsed("judgments")}
          onToggle={() => toggle("judgments")}
        />
        {!isCollapsed("judgments") && (
          <>
            <SortToggle value={judgmentSort} onChange={setJudgmentSort} />
            {sortEls(byType("judgment"), judgmentSort).map((e) => (
              <ElementCard key={e.id} e={e} />
            ))}
          </>
        )}
      </div>
      <div ref={refPrinciples}>
        <SectionHeader
          title={`Principles (${byType("principle").length})`}
          collapsed={isCollapsed("principles")}
          onToggle={() => toggle("principles")}
        />
        {!isCollapsed("principles") && (
          <>
            <SortToggle value={principleSort} onChange={setPrincipleSort} />
            {sortEls(byType("principle"), principleSort).map((e) => (
              <ElementCard key={e.id} e={e} />
            ))}
          </>
        )}
      </div>
      <div ref={refTheories}>
        <SectionHeader
          title={`Background Theories (${byType("theory").length})`}
          collapsed={isCollapsed("theories")}
          onToggle={() => toggle("theories")}
        />
        {!isCollapsed("theories") && (
          <>
            <SortToggle value={theorySort} onChange={setTheorySort} />
            {sortEls(byType("theory"), theorySort).map((e) => (
              <ElementCard key={e.id} e={e} />
            ))}
          </>
        )}
      </div>
      {showRelations ? (
        <>
          <div ref={refArguments}>
            <SectionHeader
              title={`Arguments (${argGroups.length})`}
              collapsed={isCollapsed("arguments")}
              onToggle={() => toggle("arguments")}
            />
            {!isCollapsed("arguments") && (
              <>
                <SortToggle value={relSort} onChange={setRelSort} />
                {argGroups.map((group) => (
                  <ArgumentCard key={group.argId} rels={group.rels} />
                ))}
              </>
            )}
          </div>
          <div ref={refRelations}>
            <SectionHeader
              title={`Relations (${plainRelGroups.length})`}
              collapsed={isCollapsed("relations")}
              onToggle={() => toggle("relations")}
            />
            {!isCollapsed("relations") && (
              <>
                <SortToggle value={relSort} onChange={setRelSort} />
                {plainRelGroups.map((group) => (
                  <RelationCard key={relKey(group)} r={group.rels[0]} />
                ))}
              </>
            )}
          </div>
        </>
      ) : (
        <div ref={refRelations}>
          <SectionHeader
            title={`Arguments (${relGroups.length})`}
            collapsed={isCollapsed("relations")}
            onToggle={() => toggle("relations")}
          />
          {!isCollapsed("relations") && (
            <>
              <SortToggle value={relSort} onChange={setRelSort} />
              {relGroups.map((group) =>
                group.argId ? (
                  <ArgumentCard key={group.argId} rels={group.rels} />
                ) : (
                  <RelationCard key={relKey(group)} r={group.rels[0]} />
                ),
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
