/**
 * @fileoverview Card, badge, and section display components for TextTab.
 * All components that read the shared Ctx context live here.
 * @module components/TextTabCards
 */

import { useContext, useState } from "react";
import { sortElementIds } from "../../utils/stateUtils.js";
import { C } from "../../constants/colors.js";
import {
  GHOST_BTN_STYLE,
  WITHDRAW_BTN_STYLE,
  CARD_STYLE,
  META_LABEL_STYLE,
  CONTENT_FONT_SIZE,
} from "../../constants/textTabStyles.js";
import { Ctx } from "./TextTabContext.js";

// ─── Highlight ────────────────────────────────────────────────────────────────

export function Highlight({ text, query }) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        style={{
          background: C.supports + "44",
          color: "inherit",
          borderRadius: 2,
          padding: "0 1px",
        }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// ─── MetaChip ─────────────────────────────────────────────────────────────────

/** Consistently-styled bordered pill for element metadata (confidence, status, scores). */
function MetaChip({ color = C.dim, title, children }) {
  return (
    <span
      title={title}
      style={{
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 4,
        border: `1px solid ${color}55`,
        color,
        lineHeight: 1.6,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, onAdd, collapsed, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1,
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 1.5,
        color: C.dim,
        textTransform: "uppercase",
        padding: "14px 0 6px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: collapsed ? 0 : 10,
        cursor: onToggle ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {onToggle && (
          <span
            style={{
              fontSize: 10,
              transition: "transform 0.15s",
              display: "inline-block",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          >
            ▼
          </span>
        )}
        {title}
      </span>
      {onAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          style={{
            ...GHOST_BTN_STYLE,
            fontSize: 13,
            padding: "0 5px 1px",
            fontWeight: "bold",
            letterSpacing: 0,
            textTransform: "none",
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({ id }) {
  const { badgeColor, selected, onSelect } = useContext(Ctx);
  const color = badgeColor(id);
  const isSelected = selected === id;
  return (
    <span
      onClick={() => onSelect((prev) => (prev === id ? null : id))}
      style={{
        fontSize: 12,
        fontWeight: "bold",
        padding: "1px 7px",
        marginRight: "5px",
        borderRadius: 4,
        background: isSelected ? color + "44" : color + "22",
        color,
        border: `1px solid ${isSelected ? color : color + "55"}`,
        flexShrink: 0,
        lineHeight: 1.8,
        cursor: "pointer",
        width: "3em",
        textAlign: "center",
      }}
    >
      {id}
    </span>
  );
}

// ─── Status label ─────────────────────────────────────────────────────────────

export function StatusLabel({ status }) {
  if (status === "withdrawn")
    return <MetaChip color={C.withdrawnMark}>withdrawn</MetaChip>;
  if (status === "rejected")
    return <MetaChip color={C.rejectedMark}>rejected</MetaChip>;
  if (status === "revised")
    return <MetaChip color={C.revised}>revised</MetaChip>;
  return null;
}

// ─── Action buttons ───────────────────────────────────────────────────────────

export function ActionButtons({ onRevise, onWithdraw }) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button onClick={onRevise} style={GHOST_BTN_STYLE}>
        Revise
      </button>
      {onWithdraw && (
        <button onClick={onWithdraw} style={WITHDRAW_BTN_STYLE}>
          Withdraw
        </button>
      )}
    </div>
  );
}

// ─── Element card ─────────────────────────────────────────────────────────────

export function ElementCard({ e, dim }) {
  const {
    pCovers,
    onEditRequest,
    onWithdrawRequest,
    badgeColor,
    search,
    withdrawalDeltas,
  } = useContext(Ctx);
  const isW = e.status === "withdrawn";
  const isR = e.status === "rejected";
  const isActive = e.status === "active" || e.status === "revised";
  // withdrawalDelta = how account and systematicity change if this element is withdrawn.
  // Negative account delta → removing hurts account (element is well-covered by theory).
  // Positive systematicity delta (for principles) → theory becomes leaner without this element.
  const withdrawalDelta =
    isActive && withdrawalDeltas ? (withdrawalDeltas[e.id] ?? null) : null;
  const color = badgeColor(e.id);
  return (
    <div
      style={{
        ...CARD_STYLE,
        opacity: dim ? 0.4 : isW || isR ? 0.55 : 1,
        borderLeft: `3px solid ${color}`,
        paddingLeft: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: 5,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          <Badge id={e.id} />
          <MetaChip>{typeof e.confidence === "number" ? e.confidence.toFixed(2) : e.confidence}</MetaChip>
          <StatusLabel status={e.status} />
          {pCovers[e.id]?.length > 0 && (
            <MetaChip>covers: {pCovers[e.id].join(", ")}</MetaChip>
          )}
          {withdrawalDelta != null &&
            (() => {
              const { delta_account: dA, delta_systematicity: dS } =
                withdrawalDelta;
              const fmt = (v) => `${v > 0 ? "+" : ""}${v.toFixed(3)}`;
              const col = (v) =>
                v < -0.001 ? C.supports : v > 0.001 ? C.conflicts : C.dim;
              return (
                <>
                  <MetaChip color={col(dA)} title="Account change if withdrawn">
                    if withdrawn: Account {fmt(dA)}
                  </MetaChip>
                  {dS !== 0 && (
                    <MetaChip
                      color={col(dS)}
                      title="Systematicity change if withdrawn"
                    >
                      if withdrawn Systematicity {fmt(dS)}
                    </MetaChip>
                  )}
                </>
              );
            })()}
        </div>
        <ActionButtons
          onRevise={() => onEditRequest(e.id)}
          onWithdraw={!isW && !isR ? () => onWithdrawRequest(e.id) : null}
        />
      </div>
      <div
        style={{
          fontSize: CONTENT_FONT_SIZE,
          color: isW || isR ? C.dim : C.text,
          lineHeight: 1.65,
          textDecoration: isW || isR ? "line-through" : "none",
        }}
      >
        <Highlight text={e.text} query={search} />
      </div>
      {e.previousText && (
        <div style={{ ...META_LABEL_STYLE, color: C.dim }}>
          Previously: "{e.previousText}"
        </div>
      )}
      {e.reason && (
        <div style={{ ...META_LABEL_STYLE, color: C.dim }}>
          Withdrawn: {e.reason}
        </div>
      )}
    </div>
  );
}

// ─── Argument card (grouped jointly_entails) ──────────────────────────────────

/** Groups an array of relations: jointly_entails/jointly_precludes with the same argumentId become one entry. */
function groupRelationsByArgument(rels) {
  const groups = [];
  const seenArgIds = new Set();
  for (const r of rels) {
    if (
      (r.type === "jointly_entails" || r.type === "jointly_precludes") &&
      r.argumentId
    ) {
      if (seenArgIds.has(r.argumentId)) continue;
      seenArgIds.add(r.argumentId);
      groups.push({
        argId: r.argumentId,
        rels: rels.filter((x) => x.argumentId === r.argumentId),
      });
    } else {
      groups.push({ argId: null, rels: [r] });
    }
  }
  return groups;
}

export function ArgumentCard({ rels, dim }) {
  const {
    state,
    selectedRel,
    onSelectRel,
    onSelect,
    onEditRelRequest,
    onWithdrawRelRequest,
    badgeColor,
    search,
  } = useContext(Ctx);
  const isSel = rels.some((r) => r === selectedRel);
  // All rels in an argument share the same conclusion.
  const conclusionId = rels[0].to;
  const allNodeIds = [...new Set([...rels.map((r) => r.from), conclusionId])];

  return (
    <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : 1 }}>
      {rels.map((r) => (
        <div
          key={r.from}
          onClick={() => {
            onSelectRel((prev) => (rels.includes(prev) ? null : r));
            onSelect(() => null);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 5,
            cursor: "pointer",
            borderRadius: 4,
            padding: "2px 4px",
            margin: "0 -4px 4px",
            background: isSel ? `${C.border}44` : "transparent",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexWrap: "wrap",
            }}
          >
            <Badge id={r.from} />
            <span
              style={{
                color: C[rels[0].type] ?? C.jointly_entails,
                fontSize: 11,
                fontWeight: "bold",
              }}
            >
              {rels[0].type === "jointly_precludes"
                ? "⇒ jointly precludes ⇒"
                : "→ jointly entails →"}
            </span>
            <Badge id={r.to} />
            <StatusLabel status={r.status} />
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <ActionButtons
              onRevise={() => onEditRelRequest(r)}
              onWithdraw={
                r.status !== "withdrawn" ? () => onWithdrawRelRequest(r) : null
              }
            />
          </div>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        {allNodeIds.map((id, index) => {
          const el = state.elements.find((e) => e.id === id);
          if (!el) return null;
          return (
            <div
              key={id}
              style={{
                fontSize: CONTENT_FONT_SIZE,
                color: C.text,
                lineHeight: 1.5,
              }}
            >
              <div>
                {index == allNodeIds.length - 1 && (
                  <b>
                    Therefore
                    {rels[0].type === "jointly_precludes" && (
                      <span
                        style={{
                          color: C.jointly_precludes,
                          fontStyle: "italic",
                          fontWeight: "normal",
                        }}
                      >
                        {" "}
                        not
                      </span>
                    )}
                    :
                  </b>
                )}
              </div>
              <span
                style={{
                  color: badgeColor(id),
                  fontWeight: "bold",
                  marginRight: 6,
                }}
              >
                {id}:
              </span>
              <Highlight text={el.text} query={search} />
            </div>
          );
        })}
      </div>
      {rels[0].explanation && (
        <div
          style={{
            fontSize: CONTENT_FONT_SIZE,
            color: C.dim,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          <Highlight text={rels[0].explanation} query={search} />
        </div>
      )}
    </div>
  );
}

// ─── Relation card ────────────────────────────────────────────────────────────

export function RelationCard({ r, dim }) {
  const {
    state,
    selectedRel,
    onSelectRel,
    onSelect,
    onEditRelRequest,
    onWithdrawRelRequest,
    badgeColor,
    search,
  } = useContext(Ctx);
  const fromEl = state.elements.find((e) => e.id === r.from);
  const toEl = state.elements.find((e) => e.id === r.to);
  const isSel = r === selectedRel;
  return (
    <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : 1 }}>
      <div
        onClick={() => {
          onSelectRel((prev) => (prev === r ? null : r));
          onSelect(() => null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 5,
          cursor: "pointer",
          borderRadius: 4,
          padding: "2px 4px",
          margin: "0 -4px 8px",
          background: isSel ? `${C.border}44` : "transparent",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexWrap: "wrap",
          }}
        >
          <Badge id={r.from} />
          <span style={{ color: C[r.type], fontSize: 11, fontWeight: "bold" }}>
            → {r.type} →
          </span>
          <Badge id={r.to} />
          <StatusLabel status={r.status} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ActionButtons
            onRevise={() => onEditRelRequest(r)}
            onWithdraw={
              r.status !== "withdrawn" ? () => onWithdrawRelRequest(r) : null
            }
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        {[fromEl && r.from, toEl && r.to].filter(Boolean).map((id) => {
          const el = state.elements.find((e) => e.id === id);
          return (
            <div
              key={id}
              style={{
                fontSize: CONTENT_FONT_SIZE,
                color: C.text,
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  color: badgeColor(id),
                  fontWeight: "bold",
                  marginRight: 6,
                }}
              >
                {id}:
              </span>
              <Highlight text={el.text} query={search} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          fontSize: CONTENT_FONT_SIZE,
          color: C.dim,
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        <Highlight text={r.explanation} query={search} />
      </div>
    </div>
  );
}

// ─── Coherence group ──────────────────────────────────────────────────────────

export function CoherenceGroup({ title, color, items }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10,
          color,
          fontWeight: "bold",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {items.map((item) => (
        <div
          key={item}
          style={{
            fontSize: 12,
            color: C.dim,
            marginBottom: 6,
            lineHeight: 1.5,
            paddingLeft: 8,
            borderLeft: `2px solid ${color}55`,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

// ─── Element cards list ───────────────────────────────────────────────────────

/** Renders elements grouped by type (judgment → principle → theory). */
export function ElementCards({ els, dim }) {
  return (
    <>
      {["judgment", "principle", "theory"].flatMap((type) =>
        els
          .filter((e) => e.type === type)
          .map((e) => <ElementCard key={e.id} e={e} dim={dim} />),
      )}
    </>
  );
}

// ─── Highlighted selection section ────────────────────────────────────────────

export function HighlightedSection({
  selectedRel,
  selected,
  selectedEl,
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
          <SectionHeader title={selected} />
          {selectedEl && <ElementCard e={selectedEl} />}
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

function SortToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
      {["element", "added"].map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            ...GHOST_BTN_STYLE,
            fontSize: 10,
            padding: "1px 6px",
            letterSpacing: 0.5,
            fontWeight: value === opt ? "bold" : "normal",
            textTransform: "none",
            opacity: value === opt ? 1 : 0.6,
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

export function SectionListing({
  refJudgments,
  refPrinciples,
  refTheories,
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
        <div ref={refRelations}>
          <SectionHeader
            title={`Relations (${displayRels.length})`}
            collapsed={isCollapsed("relations")}
            onToggle={() => toggle("relations")}
          />
          {!isCollapsed("relations") && (
            <>
              <SortToggle value={relSort} onChange={setRelSort} />
              {groupRelationsByArgument(sortedRels).map((group) =>
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
        </div>
      ) : (
        <div ref={refRelations}>
          <SectionHeader
            title={`Arguments (${groupRelationsByArgument(sortedRels).length})`}
            collapsed={isCollapsed("relations")}
            onToggle={() => toggle("relations")}
          />
          {!isCollapsed("relations") && (
            <>
              <SortToggle value={relSort} onChange={setRelSort} />
              {groupRelationsByArgument(sortedRels).map((group) =>
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
        </div>
      )}
    </>
  );
}
