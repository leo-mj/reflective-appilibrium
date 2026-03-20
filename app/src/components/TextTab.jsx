/**
 * @fileoverview Scrollable text panel showing the full RE state in readable form.
 * @module components/TextTab
 */

/** @import { REState, RERelation } from '../types.js' */

import { C, getColors } from "../constants/colors.js";

/**
 * Returns the set of element IDs that should be highlighted given a selected node:
 * the selected node itself plus every element directly connected to it.
 *
 * Mirrors the same logic in {@link module:components/Graph~getNeighbours} — kept
 * as a local copy so TextTab has no dependency on Graph.
 *
 * @param {string}       selected - ID of the selected element.
 * @param {RERelation[]} visRels  - Currently visible relations.
 * @returns {Set<string>}
 */
function getHighlightedIds(selected, visRels) {
  const ids = new Set([selected]);
  visRels.forEach(r => {
    if (r.from === selected) ids.add(r.to);
    if (r.to === selected) ids.add(r.from);
  });
  return ids;
}

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
 * ### Selection interaction
 * Clicking a coloured ID badge (e.g. `J3`) calls `onSelect` with a functional
 * updater that toggles the selection, exactly mirroring a node click in the Graph.
 * The selected badge renders with a slightly stronger background to confirm the
 * active state.
 *
 * ### History tab synchronisation
 * When the History tab is active, the parent passes a round-filtered `state` so
 * this component automatically shows only what was visible at the displayed round
 * — no extra logic needed here.
 *
 * @param {Object}   props
 * @param {REState}  props.state          - RE state to render (may be round-filtered by parent).
 * @param {boolean}  props.showWithdrawn  - Whether to include withdrawn elements.
 * @param {string|null} props.selected    - ID of the currently selected element, or `null`.
 * @param {function(function(string|null): string|null): void} props.onSelect
 *   Functional updater called when the user clicks an ID badge.
 * @returns {React.ReactElement}
 */
export function TextTab({ state, showWithdrawn, selected, onSelect }) {
  const visibleEls = showWithdrawn
    ? state.elements
    : state.elements.filter(e => e.status !== "withdrawn");
  const visIds = new Set(visibleEls.map(e => e.id));

  const p = visibleEls.filter(e => e.type === "principle");

  // Which judgments each principle supports (for "covers" annotation).
  const pCovers = {};
  p.forEach(pr => { pCovers[pr.id] = []; });
  state.relations.forEach(r => {
    if (!visIds.has(r.from) || !visIds.has(r.to)) return;
    const f = state.elements.find(e => e.id === r.from);
    const to = state.elements.find(e => e.id === r.to);
    if (f?.type === "principle" && to?.type === "judgment" && r.type === "supports") pCovers[f.id]?.push(to.id);
    if (to?.type === "principle" && f?.type === "judgment" && r.type === "supports") pCovers[to.id]?.push(f.id);
  });

  const visRels = state.relations.filter(r => visIds.has(r.from) && visIds.has(r.to));

  // Partition elements and relations into highlighted vs rest when a node is selected.
  const highlightedIds = selected ? getHighlightedIds(selected, visRels) : null;
  const hlEls = highlightedIds ? visibleEls.filter(e => highlightedIds.has(e.id)) : [];
  const restEls = highlightedIds ? visibleEls.filter(e => !highlightedIds.has(e.id)) : visibleEls;
  const hlRels = highlightedIds ? visRels.filter(r => r.from === selected || r.to === selected) : [];
  const restRels = highlightedIds ? visRels.filter(r => r.from !== selected && r.to !== selected) : visRels;

  // Resolve badge color from element ID (uses stroke = saturated type color).
  const badgeColor = (id) => {
    const el = state.elements.find(e => e.id === id);
    return el ? getColors({ ...el, status: "active" }).stroke : C.dim;
  };

  function SectionHeader({ title }) {
    return (
      <div style={{
        fontSize: 10, fontWeight: "bold", letterSpacing: 1.5, color: C.dim,
        textTransform: "uppercase", padding: "14px 0 6px",
        borderBottom: `1px solid ${C.border}`, marginBottom: 10,
      }}>
        {title}
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

  function ElementCard({ e, dim }) {
    const isW = e.status === "withdrawn";
    const isR = e.status === "revised";
    return (
      <div style={{
        paddingBottom: 14, borderBottom: `1px solid ${C.border}66`, marginBottom: 14,
        opacity: dim ? 0.4 : isW ? 0.55 : 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
          <Badge id={e.id} />
          <span style={{ fontSize: 10, color: C.dim }}>{e.confidence}</span>
          {isW && <span style={{ fontSize: 10, color: C.withdrawnMark, fontStyle: "italic" }}>withdrawn</span>}
          {isR && <span style={{ fontSize: 10, color: C.revised, fontStyle: "italic" }}>revised</span>}
          {pCovers[e.id]?.length > 0 && (
            <span style={{ fontSize: 10, color: C.dim }}>covers: {pCovers[e.id].join(", ")}</span>
          )}
        </div>
        <div style={{
          fontSize: 12, color: isW ? C.dim : C.text, lineHeight: 1.65,
          textDecoration: isW ? "line-through" : "none",
        }}>
          {e.text}
        </div>
        {e.previousText && (
          <div style={{ fontSize: 11, color: C.dim, fontStyle: "italic", marginTop: 5, lineHeight: 1.5 }}>
            Previously: "{e.previousText}"
          </div>
        )}
        {e.reason && (
          <div style={{ fontSize: 11, color: C.dim, fontStyle: "italic", marginTop: 5, lineHeight: 1.5 }}>
            Withdrawn: {e.reason}
          </div>
        )}
      </div>
    );
  }

  function RelationCard({ r, dim }) {
    const fromEl = state.elements.find(e => e.id === r.from);
    const toEl = state.elements.find(e => e.id === r.to);
    return (
      <div style={{
        paddingBottom: 14, borderBottom: `1px solid ${C.border}66`, marginBottom: 14,
        opacity: dim ? 0.4 : 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          <Badge id={r.from} />
          <span style={{ color: C[r.type], fontSize: 11, fontWeight: "bold" }}>→ {r.type} →</span>
          <Badge id={r.to} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6, paddingLeft: 4 }}>
          {fromEl && (
            <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>
              <span style={{ color: badgeColor(r.from), fontWeight: "bold", marginRight: 6 }}>{r.from}:</span>
              {fromEl.text}
            </div>
          )}
          {toEl && (
            <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>
              <span style={{ color: badgeColor(r.to), fontWeight: "bold", marginRight: 6 }}>{r.to}:</span>
              {toEl.text}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, fontStyle: "italic" }}>{r.explanation}</div>
      </div>
    );
  }

  const hasCoherence = state.coherence.tensions.length > 0
    || state.coherence.orphans.length > 0
    || state.coherence.clusters.length > 0;

  const j = (els) => els.filter(e => e.type === "judgment");
  const pr = (els) => els.filter(e => e.type === "principle");
  const th = (els) => els.filter(e => e.type === "theory");

  return (
    <div style={{
      overflowY: "auto", height: "100%", padding: "0 4px 24px",
      background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif",
    }}>
      {/* Topic / header */}
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 4, lineHeight: 1.5 }}>
        <span style={{ color: C.text, fontWeight: "bold" }}>{state.topic || "No topic set"}</span>
        {state.round > 0 && <span style={{ marginLeft: 8 }}>Round {state.round}</span>}
      </div>

      {/* ── Highlighted section (only when a node is selected) ── */}
      {highlightedIds && (
        <>
          <SectionHeader title={`${selected} + neighbours`} />
          {j(hlEls).map(e => <ElementCard key={e.id} e={e} />)}
          {pr(hlEls).map(e => <ElementCard key={e.id} e={e} />)}
          {th(hlEls).map(e => <ElementCard key={e.id} e={e} />)}
          {hlRels.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: "bold", letterSpacing: 1.5, color: C.dim, textTransform: "uppercase", marginBottom: 8 }}>Relations</div>
              {hlRels.map((r, i) => <RelationCard key={i} r={r} />)}
            </>
          )}

          {/* Divider before the rest */}
          <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0 0" }} />
          <SectionHeader title="All elements" />
        </>
      )}

      {/* ── Elements ── */}
      {j(restEls).length > 0 && (
        <>
          {!highlightedIds && <SectionHeader title={`Judgments (${j(visibleEls).length})`} />}
          {j(restEls).map(e => <ElementCard key={e.id} e={e} dim={!!highlightedIds} />)}
        </>
      )}
      {pr(restEls).length > 0 && (
        <>
          {!highlightedIds && <SectionHeader title={`Principles (${pr(visibleEls).length})`} />}
          {pr(restEls).map(e => <ElementCard key={e.id} e={e} dim={!!highlightedIds} />)}
        </>
      )}
      {th(restEls).length > 0 && (
        <>
          {!highlightedIds && <SectionHeader title={`Background Theories (${th(visibleEls).length})`} />}
          {th(restEls).map(e => <ElementCard key={e.id} e={e} dim={!!highlightedIds} />)}
        </>
      )}

      {/* ── Relations ── */}
      {(restRels.length > 0 || (!highlightedIds && visRels.length > 0)) && (
        <>
          {!highlightedIds && <SectionHeader title={`Relations (${visRels.length})`} />}
          {restRels.map((r, i) => <RelationCard key={i} r={r} dim={!!highlightedIds} />)}
        </>
      )}

      {/* ── Coherence ── */}
      {hasCoherence && (
        <>
          <SectionHeader title="Coherence" />
          {state.coherence.tensions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.conflicts, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Tensions</div>
              {state.coherence.tensions.map((item, i) => (
                <div key={i} style={{ fontSize: 11, color: C.dim, marginBottom: 6, lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${C.conflicts}55` }}>{item}</div>
              ))}
            </div>
          )}
          {state.coherence.orphans.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.undermines, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Orphans</div>
              {state.coherence.orphans.map((item, i) => (
                <div key={i} style={{ fontSize: 11, color: C.dim, marginBottom: 6, lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${C.undermines}55` }}>{item}</div>
              ))}
            </div>
          )}
          {state.coherence.clusters.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.supports, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Clusters</div>
              {state.coherence.clusters.map((item, i) => (
                <div key={i} style={{ fontSize: 11, color: C.dim, marginBottom: 6, lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${C.supports}55` }}>{item}</div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Round log ── */}
      {state.log.length > 0 && (
        <>
          <SectionHeader title="Round Log" />
          {state.log.map(l => (
            <div key={l.round} style={{ paddingBottom: 10, borderBottom: `1px solid ${C.border}66`, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, marginBottom: 3 }}>Round {l.round}</div>
              <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>{l.changes}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
