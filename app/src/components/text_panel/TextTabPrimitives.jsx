/**
 * @fileoverview Atom-level building blocks for the TextTab.
 * None of these components orchestrate layout — they are used as
 * ingredients by TextTabCards and TextTabSections.
 * @module components/TextTabPrimitives
 */

import { useContext } from "react";
import { C } from "../../constants/colors.js";
import {
  GHOST_BTN_STYLE,
  WITHDRAW_BTN_STYLE,
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
export function MetaChip({ color = C.dim, title, children }) {
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
          className="tap-target-square"
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

/**
 * The clickable element id — J1, P2 — that selects an element and highlights it
 * in the graph.
 *
 * A button rather than the span it used to be: it is the only way to select an
 * element from the text, and as a span it had no focus, answered no keypress,
 * and announced itself to a screen reader as a piece of text. `aria-pressed`
 * carries the selection, which was previously visible only as a colour.
 */
export function Badge({ id }) {
  const { badgeColor, selected, onSelect } = useContext(Ctx);
  const color = badgeColor(id);
  const isSelected = selected === id;
  return (
    <button
      type="button"
      onClick={() => onSelect((prev) => (prev === id ? null : id))}
      // "J1" alone is an accessible name with no word in it — it tells a screen
      // reader nothing about what pressing it would do. The visible text is
      // kept inside the label, as WCAG 2.5.3 requires of any control that has
      // one, so voice control still reaches it by the name on screen.
      aria-label={`Select ${id}`}
      aria-pressed={isSelected}
      className="tap-target-sm"
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
    </button>
  );
}

// ─── Status label ─────────────────────────────────────────────────────────────

const TAG_COLOR = {
  withdrawn: C.withdrawnMark,
  rejected: C.rejectedMark,
  revised: C.revised,
  reinstated: C.supports,
};

/**
 * The last thing that happened to an item, dated by the round it happened in.
 * Renders nothing for an item nothing has happened to.
 *
 * @param {Object} props
 * @param {{ type: string, round: number }|null} [props.tag]
 *   From {@link module:utils/stateUtils.statusTag}.
 */
export function StatusLabel({ tag }) {
  const color = TAG_COLOR[tag?.type];
  if (!color) return null;
  return (
    <MetaChip color={color}>
      {tag.type}
      {tag.round ? ` · Round ${tag.round}` : ""}
    </MetaChip>
  );
}

/**
 * The round an element or relation first appeared in. Renders nothing when the
 * round is missing, which older hand-written states allow.
 *
 * @param {Object}  props
 * @param {number} [props.round]
 */
export function AddedRound({ round }) {
  if (!round) return null;
  return <MetaChip>Added: Round {round}</MetaChip>;
}

// ─── History round banner ─────────────────────────────────────────────────────

/**
 * Sticky marker naming the round the panel is showing. Only rendered while the
 * history slider is driving it — without this the text reads as the live state,
 * which is wrong in every round but the last.
 *
 * @param {Object} props
 * @param {{ round: number, maxRound: number }|null} props.historyView
 */
export function HistoryRoundBanner({ historyView }) {
  if (!historyView) return null;
  const { round, maxRound } = historyView;
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        background: C.panel,
        borderBottom: `1px solid ${C.revised}`,
        color: C.revised,
        fontSize: 11,
        fontWeight: "bold",
        letterSpacing: 0.5,
        padding: "5px 10px",
        marginBottom: 6,
      }}
    >
      {round === 0
        ? `Round 0 of ${maxRound} — before anything was recorded`
        : `Round ${round} of ${maxRound}${round === maxRound ? " — current" : ""}`}
    </div>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

export function ActionButtons({ onRevise, onWithdraw, onReinstate }) {
  return (
    // Grouped and named: a card holds several buttons — the id badge among them
    // — and "Revise" on its own says nothing about what it revises.
    <div
      role="group"
      aria-label="Item actions"
      style={{ display: "flex", gap: 4, flexShrink: 0 }}
    >
      <button onClick={onRevise} className="tap-target" style={GHOST_BTN_STYLE}>
        Revise
      </button>
      {onWithdraw && (
        <button
          onClick={onWithdraw}
          className="tap-target"
          style={WITHDRAW_BTN_STYLE}
        >
          Withdraw
        </button>
      )}
      {onReinstate && (
        <button
          onClick={onReinstate}
          className="tap-target"
          style={{ ...GHOST_BTN_STYLE, color: C.supports }}
        >
          Reinstate
        </button>
      )}
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
