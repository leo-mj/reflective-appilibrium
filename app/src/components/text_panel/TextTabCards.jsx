/**
 * @fileoverview Card components for the TextTab: ElementCard, ArgumentCard,
 * RelationCard, and their helpers. Building-block atoms live in
 * TextTabPrimitives.jsx; layout orchestrators live in TextTabSections.jsx.
 * @module components/TextTabCards
 */

import { useContext } from "react";
import { C } from "../../constants/colors.js";
import {
  CARD_STYLE,
  META_LABEL_STYLE,
  CONTENT_FONT_SIZE,
  cardHeader,
  cardIdentity,
  cardChips,
  cardActions,
} from "../../constants/textTabStyles.js";
import { relationTypeLabel, statusTag } from "../../utils/stateUtils.js";
import { groupOfElement } from "../../utils/groupUtils.js";
import { confidenceLabel } from "../../utils/confidenceLabel.js";
import { Ctx } from "./TextTabContext.js";
import {
  MetaChip,
  Badge,
  StatusLabel,
  ActionButtons,
  AddedRound,
  Highlight,
} from "./TextTabPrimitives.jsx";

// Re-export primitives so existing callers keep working without import-site changes.
export { Highlight, Badge, SectionHeader, StatusLabel, ActionButtons, CoherenceGroup } from "./TextTabPrimitives.jsx";

// ─── Element card ─────────────────────────────────────────────────────────────

export function ElementCard({ e, dim }) {
  const {
    state,
    pCovers,
    groups,
    onEditRequest,
    onWithdrawRequest,
    onReinstate,
    onSelect,
    badgeColor,
    search,
    withdrawalDeltas,
    isWide,
  } = useContext(Ctx);
  // Which group holds it, if any. On the canvas a collapsed group is the reason
  // an element is not drawn at all, so a card that said nothing about it left
  // the panel and the graph looking like they disagreed.
  const inGroup = groupOfElement(groups ?? [], e.id);
  const isW = e.status === "withdrawn";
  const isR = e.status === "rejected";
  const isActive = e.status === "active" || e.status === "revised";
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
      <div style={{ ...cardHeader, gap: 6, marginBottom: 5 }}>
        <Badge id={e.id} />
        <div style={cardChips(isWide)}>
          <MetaChip title={confidenceLabel(e.confidence).title}>
            Confidence: {confidenceLabel(e.confidence).text}
          </MetaChip>
          {e.origin && <MetaChip>Origin: {e.origin}</MetaChip>}
          <AddedRound round={e.addedRound} />
          <StatusLabel tag={statusTag(e, state.round)} />
          {pCovers[e.id]?.length > 0 && (
            <MetaChip>covers: {pCovers[e.id].join(", ")}</MetaChip>
          )}
          {inGroup && (
            <button
              type="button"
              onClick={() =>
                onSelect((prev) => (prev === inGroup.id ? null : inGroup.id))
              }
              aria-label={`Select group ${inGroup.label}`}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
              }}
            >
              <MetaChip>Group: {inGroup.label}</MetaChip>
            </button>
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
        <div style={cardActions}>
          <ActionButtons
            compact={isWide}
            onRevise={() => onEditRequest(e.id)}
            onWithdraw={!isW && !isR ? () => onWithdrawRequest(e.id) : null}
            onReinstate={isW || isR ? () => onReinstate(e.id) : null}
          />
        </div>
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
      {/* Kept on the element after reinstatement as history, but only shown
          while it is actually withdrawn. */}
      {isW && e.reason && (
        <div style={{ ...META_LABEL_STYLE, color: C.dim }}>
          Withdrawn: {e.reason}
        </div>
      )}
    </div>
  );
}

// ─── Argument card (grouped jointly_entails) ──────────────────────────────────

export function ArgumentCard({ rels, dim }) {
  const {
    state,
    selectedRel,
    onSelectRel,
    onSelect,
    onEditRelRequest,
    onWithdrawRelRequest,
    onReinstateRel,
    badgeColor,
    search,
    isWide,
  } = useContext(Ctx);
  const isSel = rels.some((r) => r === selectedRel);
  const conclusionId = rels[0].to;
  const allNodeIds = [...new Set([...rels.map((r) => r.from), conclusionId])];

  return (
    <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : 1 }}>
      {rels.map((r) => (
        <div
          key={r.from}
          // Deliberately swallows the badges inside it: the click bubbles up
          // here and clears the element selection they just made, so pressing
          // one in a relation row does nothing. The row is about the relation,
          // and selecting one of its ends from here would say the wrong thing.
          onClick={() => {
            onSelectRel((prev) => (rels.includes(prev) ? null : r));
            onSelect(() => null);
          }}
          style={{
            ...cardHeader,
            gap: 5,
            cursor: "pointer",
            borderRadius: 4,
            padding: "2px 4px",
            margin: "0 -4px 4px",
            background: isSel ? `${C.border}44` : "transparent",
          }}
        >
          <div style={cardIdentity}>
            <Badge id={r.from} />
            <span
              style={{
                color: C[rels[0].type] ?? C.jointly_entails,
                fontSize: 11,
                fontWeight: "bold",
              }}
            >
              {rels[0].type === "precludes"
                ? "⇒ precludes ⇒"
                : rels[0].type === "jointly_precludes"
                ? "⇒ jointly precludes ⇒"
                : rels[0].type === "entails"
                ? "→ entails →"
                : "→ jointly entails →"}
            </span>
            <Badge id={r.to} />
          </div>
          <div style={cardChips(isWide)}>
            <StatusLabel tag={statusTag(r, state.round)} />
          </div>
          <div onClick={(e) => e.stopPropagation()} style={cardActions}>
            <ActionButtons
              compact={isWide}
              onRevise={() => onEditRelRequest(r)}
              onWithdraw={
                r.status !== "withdrawn" ? () => onWithdrawRelRequest(r) : null
              }
              onReinstate={
                r.status === "withdrawn" ? () => onReinstateRel(r) : null
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
                    {(rels[0].type === "precludes" || rels[0].type === "jointly_precludes") && (
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
      <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {rels[0].origin && <MetaChip>Origin: {rels[0].origin}</MetaChip>}
        {/* One round for the whole argument: its relations are added together. */}
        <AddedRound round={rels[0].addedRound} />
      </div>
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
    onReinstateRel,
    badgeColor,
    search,
    isWide,
  } = useContext(Ctx);
  const fromEl = state.elements.find((e) => e.id === r.from);
  const toEl = state.elements.find((e) => e.id === r.to);
  const isSel = r === selectedRel;
  return (
    <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : 1 }}>
      <div
        // As in ArgumentCard above: the badges inside are inert here on purpose.
        onClick={() => {
          onSelectRel((prev) => (prev === r ? null : r));
          onSelect(() => null);
        }}
        style={{
          ...cardHeader,
          gap: 5,
          cursor: "pointer",
          borderRadius: 4,
          padding: "2px 4px",
          margin: "0 -4px 8px",
          background: isSel ? `${C.border}44` : "transparent",
        }}
      >
        <div style={cardIdentity}>
          <Badge id={r.from} />
          <span style={{ color: C[r.type], fontSize: 11, fontWeight: "bold" }}>
            → {relationTypeLabel(r.type)} →
          </span>
          <Badge id={r.to} />
        </div>
        <div style={cardChips(isWide)}>
          {r.origin && <MetaChip>Origin: {r.origin}</MetaChip>}
          <AddedRound round={r.addedRound} />
          <StatusLabel tag={statusTag(r, state.round)} />
        </div>
        <div onClick={(e) => e.stopPropagation()} style={cardActions}>
          <ActionButtons
            compact={isWide}
            onRevise={() => onEditRelRequest(r)}
            onWithdraw={
              r.status !== "withdrawn" ? () => onWithdrawRelRequest(r) : null
            }
            onReinstate={
              r.status === "withdrawn" ? () => onReinstateRel(r) : null
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
