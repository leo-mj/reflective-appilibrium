/**
 * @fileoverview Card, badge, and section display components for TextTab.
 * All components that read the shared Ctx context live here.
 * @module components/TextTabCards
 */

import { useContext } from "react";
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
    return (
      <span
        style={{ ...META_LABEL_STYLE, fontSize: 10, color: C.withdrawnMark }}
      >
        withdrawn
      </span>
    );
  if (status === "revised")
    return (
      <span style={{ ...META_LABEL_STYLE, fontSize: 10, color: C.revised }}>
        revised
      </span>
    );
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
  const { pCovers, onEditRequest, onWithdrawRequest, badgeColor, search } =
    useContext(Ctx);
  const isW = e.status === "withdrawn";
  const color = badgeColor(e.id);
  return (
    <div
      style={{
        ...CARD_STYLE,
        opacity: dim ? 0.4 : isW ? 0.55 : 1,
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
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <Badge id={e.id} />
          <span style={{ fontSize: 10, color: C.dim }}>{e.confidence}</span>
          <StatusLabel status={e.status} />
          {pCovers[e.id]?.length > 0 && (
            <span style={{ fontSize: 11, color: C.dim }}>
              covers: {pCovers[e.id].join(", ")}
            </span>
          )}
        </div>
        <ActionButtons
          onRevise={() => onEditRequest(e.id)}
          onWithdraw={!isW ? () => onWithdrawRequest(e.id) : null}
        />
      </div>
      <div
        style={{
          fontSize: CONTENT_FONT_SIZE,
          color: isW ? C.dim : C.text,
          lineHeight: 1.65,
          textDecoration: isW ? "line-through" : "none",
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
      {items.map((item, i) => (
        <div
          key={i}
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
        <>
          <SectionHeader title={`${selectedRel.from} → ${selectedRel.to}`} />
          <RelationCard r={selectedRel} />
          {neighbourEls.length > 0 && <SectionHeader title="Elements" />}
          <ElementCards els={neighbourEls} />
        </>
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
              {hlRels.map((r, i) => (
                <RelationCard key={i} r={r} />
              ))}
            </>
          )}
        </>
      )}
      <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0 0" }} />
      <SectionHeader title="All elements" />
      <ElementCards els={restEls} dim />
      {restRels.map((r, i) => (
        <RelationCard key={i} r={r} dim />
      ))}
    </>
  );
}

// ─── Section listing (J / P / T / Rel) ───────────────────────────────────────

export function SectionListing({
  refJudgments,
  refPrinciples,
  refTheories,
  refRelations,
  displayEls,
  displayRels,
  isCollapsed,
  toggle,
}) {
  const byType = (type) => displayEls.filter((e) => e.type === type);
  return (
    <>
      <div ref={refJudgments}>
        <SectionHeader
          title={`Judgments (${byType("judgment").length})`}
          collapsed={isCollapsed("judgments")}
          onToggle={() => toggle("judgments")}
        />
        {!isCollapsed("judgments") &&
          byType("judgment").map((e) => <ElementCard key={e.id} e={e} />)}
      </div>
      <div ref={refPrinciples}>
        <SectionHeader
          title={`Principles (${byType("principle").length})`}
          collapsed={isCollapsed("principles")}
          onToggle={() => toggle("principles")}
        />
        {!isCollapsed("principles") &&
          byType("principle").map((e) => <ElementCard key={e.id} e={e} />)}
      </div>
      <div ref={refTheories}>
        <SectionHeader
          title={`Background Theories (${byType("theory").length})`}
          collapsed={isCollapsed("theories")}
          onToggle={() => toggle("theories")}
        />
        {!isCollapsed("theories") &&
          byType("theory").map((e) => <ElementCard key={e.id} e={e} />)}
      </div>
      <div ref={refRelations}>
        <SectionHeader
          title={`Relations (${displayRels.length})`}
          collapsed={isCollapsed("relations")}
          onToggle={() => toggle("relations")}
        />
        {!isCollapsed("relations") &&
          displayRels.map((r, i) => <RelationCard key={i} r={r} />)}
      </div>
    </>
  );
}
