/**
 * @fileoverview Scrollable text panel showing the full RE state in readable form.
 * @module components/TextTab
 */

/** @import { REState, RERelation, REElement } from '../types.js' */

import { useState } from "react";
import { C, getColors } from "../constants/colors.js";
import { getNeighbours } from "../utils/graphHelpers.js";

// ─── Module-level helpers ────────────────────────────────────────────────────

/**
 * Builds a map from principle ID to the judgment IDs it covers via "supports" relations.
 *
 * @param {REElement[]}  principles - Visible principle elements.
 * @param {RERelation[]} relations  - All relations in the state.
 * @param {Set<string>}  visIds     - IDs of all currently visible elements.
 * @param {REElement[]}  elements   - All elements in the state (for type look-ups).
 * @returns {Object.<string, string[]>}
 */
function buildPrincipleCovers(principles, relations, visIds, elements) {
  const covers = {};
  principles.forEach(p => { covers[p.id] = []; });
  relations.forEach(r => {
    if (!visIds.has(r.from) || !visIds.has(r.to) || r.type !== "supports") return;
    const f = elements.find(e => e.id === r.from);
    const t = elements.find(e => e.id === r.to);
    if (f?.type === "principle" && t?.type === "judgment") covers[f.id]?.push(t.id);
    if (t?.type === "principle" && f?.type === "judgment") covers[t.id]?.push(f.id);
  });
  return covers;
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const GHOST_BTN_STYLE = {
  background: "none", border: `1px solid ${C.border}`,
  borderRadius: 4, color: C.dim, cursor: "pointer",
  fontSize: 10, padding: "1px 7px", lineHeight: 1.8,
};

const WITHDRAW_BTN_STYLE = {
  ...GHOST_BTN_STYLE,
  background: "#dc262680", color: "#fff",
};

const CARD_STYLE = {
  paddingBottom: 14, borderBottom: `1px solid ${C.border}66`, marginBottom: 14,
};

const META_LABEL_STYLE = {
  fontSize: 10, fontStyle: "italic", marginTop: 5, lineHeight: 1.5,
};

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * Scrollable text panel that renders the full RE state as structured, styled prose.
 *
 * ### Sections (top to bottom)
 * 1. **Topic / round header**
 * 2. **Highlighted** (only when a node is `selected`) — the selected element,
 *    its neighbours, and their direct relations at full opacity.
 * 3. **All elements** — judgments, principles, background theories.  When something
 *    is selected these render at 40 % opacity below the highlighted section.
 * 4. **Relations** — every visible relation with both element texts quoted.
 * 5. **Coherence** — tensions, orphans, clusters from the latest coherence check.
 * 6. **Round log** — one entry per round.
 *
 * @param {Object}   props
 * @param {REState}  props.state          - RE state to render (may be round-filtered by parent).
 * @param {boolean}  props.showWithdrawn  - Whether to include withdrawn elements.
 * @param {string|null} props.selected    - ID of the currently selected element, or `null`.
 * @param {function(function(string|null): string|null): void} props.onSelect
 *   Functional updater called when the user clicks an ID badge.
 * @param {RERelation|null} props.selectedRel - The currently selected relation, or `null`.
 * @param {function(function): void} props.onSelectRel - Functional updater for selected relation.
 * @returns {React.ReactElement}
 */
export function TextTab({
  state, showWithdrawn,
  selected, onSelect,
  selectedRel, onSelectRel,
  onEditRequest, onEditRelRequest,
  onWithdrawRequest, onWithdrawRelRequest,
  onAddRequest, onAddRelRequest,
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────

  const visibleEls = showWithdrawn
    ? state.elements
    : state.elements.filter(e => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map(e => e.id));
  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));

  const principles = visibleEls.filter(e => e.type === "principle");
  const pCovers = buildPrincipleCovers(principles, state.relations, visIds, state.elements);

  // ── Selection partitions ──────────────────────────────────────────────────

  const highlightedIds = selected
    ? getNeighbours(selected, visRels)
    : selectedRel
      ? new Set([selectedRel.from, selectedRel.to])
      : null;

  const selectedEl = selected ? (visibleEls.find(e => e.id === selected) ?? null) : null;
  const neighbourEls = highlightedIds
    ? visibleEls.filter(e => highlightedIds.has(e.id) && e.id !== selected)
    : [];
  const restEls = highlightedIds
    ? visibleEls.filter(e => !highlightedIds.has(e.id))
    : visibleEls;
  const hlRels = selected
    ? visRels.filter(r => r.from === selected || r.to === selected)
    : selectedRel ? [selectedRel] : [];
  const restRels = selectedRel
    ? visRels.filter(r => r !== selectedRel)
    : selected
      ? visRels.filter(r => r.from !== selected && r.to !== selected)
      : visRels;

  // ── Colour helper ─────────────────────────────────────────────────────────

  const badgeColor = (id) => {
    const el = state.elements.find(e => e.id === id);
    return el ? getColors({ ...el, status: "active" }).stroke : C.dim;
  };

  // ── Inner components ──────────────────────────────────────────────────────

  function SectionHeader({ title, onAdd }) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 10, fontWeight: "bold", letterSpacing: 1.5, color: C.dim,
        textTransform: "uppercase", padding: "14px 0 6px",
        borderBottom: `1px solid ${C.border}`, marginBottom: 10,
      }}>
        <span>{title}</span>
        {onAdd && (
          <button onClick={onAdd} style={{
            ...GHOST_BTN_STYLE, fontSize: 13, padding: "0 5px 1px",
            fontWeight: "bold", letterSpacing: 0, textTransform: "none",
          }}>+</button>
        )}
      </div>
    );
  }

  function Badge({ id }) {
    const color = badgeColor(id);
    const isSelected = selected === id;
    return (
      <span
        onClick={() => onSelect(prev => prev === id ? null : id)}
        style={{
          fontSize: 11, fontWeight: "bold", padding: "1px 7px", borderRadius: 4,
          background: isSelected ? color + "44" : color + "22",
          color, border: `1px solid ${isSelected ? color : color + "55"}`,
          flexShrink: 0, lineHeight: 1.8, cursor: "pointer",
        }}>
        {id}
      </span>
    );
  }

  function StatusLabel({ status }) {
    if (status === "withdrawn")
      return <span style={{ ...META_LABEL_STYLE, fontSize: 10, color: C.withdrawnMark }}>withdrawn</span>;
    if (status === "revised")
      return <span style={{ ...META_LABEL_STYLE, fontSize: 10, color: C.revised }}>revised</span>;
    return null;
  }

  function ActionButtons({ onRevise, onWithdraw }) {
    return (
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={onRevise} style={GHOST_BTN_STYLE}>Revise</button>
        {onWithdraw && <button onClick={onWithdraw} style={WITHDRAW_BTN_STYLE}>Withdraw</button>}
      </div>
    );
  }

  function ElementCard({ e, dim }) {
    const isW = e.status === "withdrawn";
    return (
      <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : isW ? 0.55 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Badge id={e.id} />
            <span style={{ fontSize: 10, color: C.dim }}>{e.confidence}</span>
            <StatusLabel status={e.status} />
            {pCovers[e.id]?.length > 0 && (
              <span style={{ fontSize: 10, color: C.dim }}>covers: {pCovers[e.id].join(", ")}</span>
            )}
          </div>
          <ActionButtons
            onRevise={() => onEditRequest(e.id)}
            onWithdraw={!isW ? () => onWithdrawRequest(e.id) : null}
          />
        </div>
        <div style={{
          fontSize: 12, color: isW ? C.dim : C.text, lineHeight: 1.65,
          textDecoration: isW ? "line-through" : "none",
        }}>
          {e.text}
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

  function RelationCard({ r, dim }) {
    const fromEl = state.elements.find(e => e.id === r.from);
    const toEl = state.elements.find(e => e.id === r.to);
    const isSel = r === selectedRel;
    return (
      <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : 1 }}>
        <div
          onClick={() => { onSelectRel(prev => prev === r ? null : r); onSelect(() => null); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 5, cursor: "pointer", borderRadius: 4, padding: "2px 4px", margin: "0 -4px 8px",
            background: isSel ? `${C.border}44` : "transparent",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Badge id={r.from} />
            <span style={{ color: C[r.type], fontSize: 11, fontWeight: "bold" }}>→ {r.type} →</span>
            <Badge id={r.to} />
            <StatusLabel status={r.status} />
          </div>
          <div onClick={e => e.stopPropagation()}>
            <ActionButtons
              onRevise={() => onEditRelRequest(r)}
              onWithdraw={r.status !== "withdrawn" ? () => onWithdrawRelRequest(r) : null}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6, paddingLeft: 4 }}>
          {[fromEl && r.from, toEl && r.to].filter(Boolean).map(id => {
            const el = state.elements.find(e => e.id === id);
            return (
              <div key={id} style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>
                <span style={{ color: badgeColor(id), fontWeight: "bold", marginRight: 6 }}>{id}:</span>
                {el.text}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, fontStyle: "italic" }}>{r.explanation}</div>
      </div>
    );
  }

  function CoherenceGroup({ title, color, items }) {
    if (!items.length) return null;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 10, color, fontWeight: "bold",
          letterSpacing: 1, textTransform: "uppercase", marginBottom: 6,
        }}>{title}</div>
        {items.map((item, i) => (
          <div key={i} style={{
            fontSize: 11, color: C.dim, marginBottom: 6,
            lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${color}55`,
          }}>{item}</div>
        ))}
      </div>
    );
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  /** Renders element cards for all three types in order: judgments, principles, theories. */
  const renderElementCards = (els, dim) =>
    ["judgment", "principle", "theory"].flatMap(type =>
      els.filter(e => e.type === type).map(e => <ElementCard key={e.id} e={e} dim={dim} />)
    );

  const byType = (type) => (els) => els.filter(e => e.type === type);
  const j  = byType("judgment");
  const pr = byType("principle");
  const th = byType("theory");

  const addMenuItems = [
    { label: "Add element",  action: () => { setShowAddMenu(false); onAddRequest("judgment"); } },
    { label: "Add relation", action: () => { setShowAddMenu(false); onAddRelRequest(); } },
  ];

  const hasCoherence =
    state.coherence.tensions.length > 0 ||
    state.coherence.orphans.length > 0 ||
    state.coherence.clusters.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      overflowY: "auto", height: "100%", padding: "0 4px 24px",
      background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif",
    }}>

      {/* ── Topic / header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
          <span style={{ color: C.text, fontWeight: "bold" }}>{state.topic || "No topic set"}</span>
          {state.round > 0 && <span style={{ marginLeft: 8 }}>Round {state.round}</span>}
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowAddMenu(m => !m)}
            style={{
              background: C.supports, border: "none", borderRadius: 6,
              color: "#fff", cursor: "pointer", fontSize: 18, fontWeight: "bold",
              width: 28, height: 28, lineHeight: 1, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            +
          </button>
          {showAddMenu && (
            <>
              <div onClick={() => setShowAddMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 150, overflow: "hidden",
              }}>
                {addMenuItems.map(({ label, action }) => (
                  <button key={label} onClick={action} style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: "none", border: "none", color: C.text,
                    cursor: "pointer", fontSize: 12, padding: "10px 14px",
                    borderBottom: `1px solid ${C.border}`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.border; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Highlighted section (node or relation selected) ── */}
      {highlightedIds && (
        <>
          {selectedRel ? (
            <>
              <SectionHeader title={`${selectedRel.from} → ${selectedRel.to}`} />
              <RelationCard r={selectedRel} />
              {neighbourEls.length > 0 && <SectionHeader title="Elements" />}
              {renderElementCards(neighbourEls)}
            </>
          ) : (
            <>
              <SectionHeader title={selected} />
              {selectedEl && <ElementCard e={selectedEl} />}
              {neighbourEls.length > 0 && <SectionHeader title="Neighbours" />}
              {renderElementCards(neighbourEls)}
              {hlRels.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10, fontWeight: "bold", letterSpacing: 1.5,
                    color: C.dim, textTransform: "uppercase", marginBottom: 8,
                  }}>Relations</div>
                  {hlRels.map((r, i) => <RelationCard key={i} r={r} />)}
                </>
              )}
            </>
          )}
          <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0 0" }} />
          <SectionHeader title="All elements" />
          {renderElementCards(restEls, true)}
          {restRels.map((r, i) => <RelationCard key={i} r={r} dim />)}
        </>
      )}

      {/* ── Full element / relation listing (nothing selected) ── */}
      {!highlightedIds && (
        <>
          <SectionHeader title={`Judgments (${j(visibleEls).length})`}           onAdd={() => onAddRequest("judgment")} />
          {j(restEls).map(e => <ElementCard key={e.id} e={e} />)}
          <SectionHeader title={`Principles (${pr(visibleEls).length})`}          onAdd={() => onAddRequest("principle")} />
          {pr(restEls).map(e => <ElementCard key={e.id} e={e} />)}
          <SectionHeader title={`Background Theories (${th(visibleEls).length})`} onAdd={() => onAddRequest("theory")} />
          {th(restEls).map(e => <ElementCard key={e.id} e={e} />)}
          <SectionHeader title={`Relations (${visRels.length})`}                  onAdd={onAddRelRequest} />
          {restRels.map((r, i) => <RelationCard key={i} r={r} />)}
        </>
      )}

      {/* ── Coherence ── */}
      {hasCoherence && (
        <>
          <SectionHeader title="Coherence" />
          <CoherenceGroup title="Tensions" color={C.conflicts}  items={state.coherence.tensions} />
          <CoherenceGroup title="Orphans"  color={C.undermines} items={state.coherence.orphans} />
          <CoherenceGroup title="Clusters" color={C.supports}   items={state.coherence.clusters} />
        </>
      )}

      {/* ── Round log ── */}
      {state.log.length > 0 && (
        <>
          <SectionHeader title="Round Log" />
          {state.log.map(l => (
            <div key={l.round} style={{ ...CARD_STYLE, paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, marginBottom: 3 }}>Round {l.round}</div>
              <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>{l.changes}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
