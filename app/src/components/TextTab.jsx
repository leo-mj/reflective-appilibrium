/**
 * @fileoverview Scrollable text panel showing the full RE state in readable form.
 * @module components/TextTab
 */

/** @import { REState, RERelation, REElement } from '../types.js' */

import { useState, useRef, createContext, useContext } from "react";
import { C, getColors } from "../constants/colors.js";
import { getNeighbours } from "../utils/graphHelpers.js";
import { AddElementForm } from "./AddElementModal.jsx";
import { AddRelationForm } from "./AddRelationModal.jsx";

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
  fontSize: 12, padding: "1px 7px", lineHeight: 1.8,
};

const WITHDRAW_BTN_STYLE = {
  ...GHOST_BTN_STYLE,
  background: "#dc262680", color: "#fff",
};

const CARD_STYLE = {
  paddingBottom: 14, borderBottom: `1px solid ${C.border}66`, marginBottom: 14,
};

const META_LABEL_STYLE = {
  fontSize: 12, fontStyle: "italic", marginTop: 5, lineHeight: 1.5,
};

// ─── Context ─────────────────────────────────────────────────────────────────

/** Shared values threaded to all sub-components without prop drilling. */
const Ctx = createContext(null);

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, onAdd }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 12, fontWeight: "bold", letterSpacing: 1.5, color: C.dim,
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
  const { badgeColor, selected, onSelect } = useContext(Ctx);
  const color = badgeColor(id);
  const isSelected = selected === id;
  return (
    <span
      onClick={() => onSelect(prev => prev === id ? null : id)}
      style={{
        fontSize: 12, fontWeight: "bold", padding: "1px 7px", borderRadius: 4,
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
  const { pCovers, onEditRequest, onWithdrawRequest } = useContext(Ctx);
  const isW = e.status === "withdrawn";
  return (
    <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : isW ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Badge id={e.id} />
          <span style={{ fontSize: 10, color: C.dim }}>{e.confidence}</span>
          <StatusLabel status={e.status} />
          {pCovers[e.id]?.length > 0 && (
            <span style={{ fontSize: 11, color: C.dim }}>covers: {pCovers[e.id].join(", ")}</span>
          )}
        </div>
        <ActionButtons
          onRevise={() => onEditRequest(e.id)}
          onWithdraw={!isW ? () => onWithdrawRequest(e.id) : null}
        />
      </div>
      <div style={{
        fontSize: 14, color: isW ? C.dim : C.text, lineHeight: 1.65,
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
  const { state, selectedRel, onSelectRel, onSelect, onEditRelRequest, onWithdrawRelRequest, badgeColor } = useContext(Ctx);
  const fromEl = state.elements.find(e => e.id === r.from);
  const toEl   = state.elements.find(e => e.id === r.to);
  const isSel  = r === selectedRel;
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
          fontSize: 12, color: C.dim, marginBottom: 6,
          lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${color}55`,
        }}>{item}</div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * Scrollable text panel that renders the full RE state as structured, styled prose.
 *
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {boolean}  props.showWithdrawn
 * @param {string|null} props.selected
 * @param {function} props.onSelect
 * @param {RERelation|null} props.selectedRel
 * @param {function} props.onSelectRel
 * @returns {React.ReactElement}
 */
export function TextTab({
  state, showWithdrawn,
  selected, onSelect,
  selectedRel, onSelectRel,
  onEditRequest, onEditRelRequest,
  onWithdrawRequest, onWithdrawRelRequest,
  onAddElement, onAddRelation,
}) {
  const scrollRef = useRef(null);
  const ELEMENT_DEFAULTS = { type: "judgment", confidence: "moderate", origin: "user", text: "" };
  const relationDefaults = () => {
    const ids = state.elements.filter(e => e.status !== "withdrawn").map(e => e.id);
    return { from: ids[0] ?? "", to: ids[1] ?? "", type: "supports", explanation: "" };
  };
  const [addTab, setAddTab]         = useState("element");
  const [elementForm, setElementForm] = useState(ELEMENT_DEFAULTS);
  const [relationForm, setRelationForm] = useState(relationDefaults);

  const openAddElement = (type) => {
    setAddTab("element");
    setElementForm(prev => ({ ...prev, type }));
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openAddRelation = () => {
    setAddTab("relation");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const visibleEls = showWithdrawn
    ? state.elements
    : state.elements.filter(e => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map(e => e.id));
  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));

  const principles = visibleEls.filter(e => e.type === "principle");
  const pCovers = buildPrincipleCovers(principles, state.relations, visIds, state.elements);

  const badgeColor = (id) => {
    const el = state.elements.find(e => e.id === id);
    return el ? getColors({ ...el, status: "active" }).stroke : C.dim;
  };

  // ── Selection partitions ──────────────────────────────────────────────────

  const highlightedIds = selected
    ? getNeighbours(selected, visRels)
    : selectedRel
      ? new Set([selectedRel.from, selectedRel.to])
      : null;

  const selectedEl    = selected ? (visibleEls.find(e => e.id === selected) ?? null) : null;
  const neighbourEls  = highlightedIds ? visibleEls.filter(e => highlightedIds.has(e.id) && e.id !== selected) : [];
  const restEls       = highlightedIds ? visibleEls.filter(e => !highlightedIds.has(e.id)) : visibleEls;
  const hlRels        = selected ? visRels.filter(r => r.from === selected || r.to === selected)
                          : selectedRel ? [selectedRel] : [];
  const restRels      = selectedRel ? visRels.filter(r => r !== selectedRel)
                          : selected ? visRels.filter(r => r.from !== selected && r.to !== selected)
                          : visRels;

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderElementCards = (els, dim) =>
    ["judgment", "principle", "theory"].flatMap(type =>
      els.filter(e => e.type === type).map(e => <ElementCard key={e.id} e={e} dim={dim} />)
    );

  const byType = (type) => (els) => els.filter(e => e.type === type);
  const j  = byType("judgment");
  const pr = byType("principle");
  const th = byType("theory");

  const hasCoherence =
    state.coherence.tensions.length > 0 ||
    state.coherence.orphans.length > 0 ||
    state.coherence.clusters.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Ctx.Provider value={{ state, selected, onSelect, selectedRel, onSelectRel, onEditRequest, onEditRelRequest, onWithdrawRequest, onWithdrawRelRequest, badgeColor, pCovers }}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <div ref={scrollRef} style={{
        overflowY: "auto", flex: 1, padding: "0 4px 24px",
        background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif",
      }}>

        {/* ── Add panel ── */}
        <div style={{
          marginBottom: 12, padding: "10px 10px 12px",
          borderRadius: 8, background: C.panel, border: `1px solid ${C.border}`,
        }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {["element", "relation"].map(t => (
              <button key={t} onClick={() => setAddTab(t)} style={{
                flex: 1, padding: "4px 0", borderRadius: 4, cursor: "pointer", fontSize: 12,
                border: `1px solid ${C.border}`,
                background: addTab === t ? C.border : "transparent",
                color: addTab === t ? C.text : C.dim,
              }}>
                {t === "element" ? "Element" : "Relation"}
              </button>
            ))}
          </div>
          {/* Active form */}
          {addTab === "element"
            ? <AddElementForm form={elementForm} setForm={setElementForm} />
            : <AddRelationForm form={relationForm} setForm={setRelationForm}
                elements={visibleEls.filter(e => e.status !== "withdrawn")} />
          }
          {/* Save button */}
          <button
            disabled={addTab === "element" ? !elementForm.text.trim() : (!relationForm.from || !relationForm.to || relationForm.from === relationForm.to)}
            onClick={() => {
              if (addTab === "element") {
                onAddElement(elementForm);
                setElementForm(ELEMENT_DEFAULTS);
              } else {
                onAddRelation(relationForm);
                setRelationForm(relationDefaults());
              }
            }}
            style={{
              width: "100%", marginTop: 4, padding: "6px 0", borderRadius: 4,
              border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold",
              background: C.supports, color: "#fff",
            }}>
            Add {addTab}
          </button>
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
            <SectionHeader title={`Judgments (${j(visibleEls).length})`} onAdd={() => openAddElement("judgment")} />
            {j(restEls).map(e => <ElementCard key={e.id} e={e} />)}
            <SectionHeader title={`Principles (${pr(visibleEls).length})`} onAdd={() => openAddElement("principle")} />
            {pr(restEls).map(e => <ElementCard key={e.id} e={e} />)}
            <SectionHeader title={`Background Theories (${th(visibleEls).length})`} onAdd={() => openAddElement("theory")} />
            {th(restEls).map(e => <ElementCard key={e.id} e={e} />)}
            <SectionHeader title={`Relations (${visRels.length})`} onAdd={openAddRelation} />
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
      <button
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "absolute", bottom: 10, left: 10,
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 6, color: C.dim, cursor: "pointer",
          fontSize: 16, padding: "3px 8px",
        }}>
        ↑ Top
      </button>
      </div>
    </Ctx.Provider>
  );
}
