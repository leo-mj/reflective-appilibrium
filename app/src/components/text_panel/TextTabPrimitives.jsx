/**
 * @fileoverview Atom-level building blocks for the TextTab.
 * None of these components orchestrate layout — they are used as
 * ingredients by TextTabCards and TextTabSections.
 * @module components/TextTabPrimitives
 */

import { useContext } from "react";
import { C } from "../../constants/colors.js";
import {
  COMPACT_BTN_STYLE,
  CONTENT_FONT_SIZE,
  GHOST_BTN_STYLE,
  WITHDRAW_BTN_STYLE,
} from "../../constants/textTabStyles.js";
import { Ctx } from "./TextTabContext.js";
import { Tooltip } from "../Tooltip.jsx";

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

/**
 * Consistently-styled bordered pill for a *set* of short values — the ids a
 * principle covers, a cluster's members.
 *
 * It is no longer how a card's own metadata is drawn: a chip has to carry its
 * own name inside it ("Confidence: Moderate"), which spends the width twice and
 * leaves a row of pills that look alike. Those are {@link StatField}s now, and
 * what is left for a chip is the case it was always right for — several values
 * of one kind, where the name belongs to the set rather than to each.
 *
 * As wide as its text, capped at its container and cut with an ellipsis if it
 * does not fit, so `title` is worth passing on anything long. That text goes
 * through {@link module:components/Tooltip}, not the DOM's `title` — the app
 * has one tooltip, and a native one differs from it in look, in delay and in
 * being unreachable by a finger.
 *
 * The border is the chip's own colour at a third, *when that colour can be
 * faded* — a status tag's hex can, and the theme tokens cannot: `C.dim` is
 * `var(--c-dim)`, and `var(--c-dim)55` is not a colour, so the whole
 * declaration was dropped and the default chip had no border at all. Those fall
 * back to the panel's border token, which is the line they wanted in the first
 * place.
 */
export function MetaChip({ color = C.dim, title, children }) {
  return (
    <Tooltip text={title}>
      <span
        style={{
          fontSize: 10,
          padding: "1px 4px",
          borderRadius: 4,
          border: `1px solid ${color.startsWith("#") ? `${color}55` : C.border}`,
          color,
          lineHeight: 1.5,
          flexShrink: 0,
          whiteSpace: "nowrap",
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {children}
      </span>
    </Tooltip>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {function} [props.onAdd] - Renders a "+" at the trailing edge.
 * @param {string} [props.addLabel] - Its accessible name. "+" on its own is a
 *   name with no word in it, which tells a screen reader nothing about what
 *   pressing it would do — and the visible title usually carries a count, so it
 *   cannot stand in.
 * @param {boolean} [props.collapsed]
 * @param {function} [props.onToggle]
 */
export function SectionHeader({ title, onAdd, addLabel, collapsed, onToggle }) {
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
        <Tooltip text={addLabel ?? `Add to ${title}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={addLabel ?? `Add to ${title}`}
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
        </Tooltip>
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
 *
 * Filled with the type's own node colour and written in the ink that fill takes,
 * exactly as the graph's `+J/+P/+T` buttons are — so a `P` badge and a principle
 * node are the same colour in whichever mode is in force. It was a tinted chip
 * before, and a tint cannot be: the ink then has to read against the *panel*,
 * and the node ramps hold no tone dark enough to do that on the light one.
 *
 * Selection is a ring outside the border rather than a stronger tint, which a
 * solid fill leaves no room for.
 */
export function Badge({ id }) {
  const { badgeColor, badgeFill, badgeTextColor, selected, onSelect } =
    useContext(Ctx);
  const stroke = badgeColor(id);
  const fill = badgeFill(id);
  const ink = badgeTextColor(id);
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
        background: fill,
        color: ink,
        border: `1px solid ${stroke}`,
        boxShadow: isSelected ? `0 0 0 2px ${stroke}` : "none",
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
 * What last happened to the item, as a stat field: "Status / Withdrawn ·
 * Round 8", coloured by the event. Renders nothing for an item nothing has
 * happened to, so an untouched card carries no such column at all.
 *
 * @param {Object} props
 * @param {{ type: string, round?: number }|null} [props.tag] - From `statusTag`.
 */
export function StatusField({ tag }) {
  const color = TAG_COLOR[tag?.type];
  if (!color) return null;
  const word = `${tag.type[0].toUpperCase()}${tag.type.slice(1)}`;
  const text = `${word}${tag.round ? ` · Round ${tag.round}` : ""}`;
  return (
    <StatField label="Status" color={color} title={text}>
      {text}
    </StatField>
  );
}

// ─── Stat fields ──────────────────────────────────────────────────────────────

/**
 * A stat's caption: the field name over the value, and the header of a stat
 * section. Small, spaced and upper-cased *in CSS* rather than in the string —
 * the DOM keeps "Confidence", which is what a test or a copied selection reads.
 */
const STAT_LABEL_STYLE = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/**
 * One of a card's stats: its name above, its value below.
 *
 * A caption and a value rather than the bordered chip this used to be. A chip
 * has to carry its own name inside it — "Confidence: Moderate" — which spends
 * the width twice and leaves a row of pills that all look alike to be read one
 * by one. With the names on their own line the values line up down the column
 * and can be scanned without them.
 *
 * The value is one ellipsised line by default, since the columns are what the
 * uniformity is made of and a value that wraps moves the rows under it. `wrap`
 * is for the fields whose value is a set of chips rather than a phrase.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string} [props.color] - The event colour, for a status. Tints both
 *   lines; the default is a dim caption over the panel's own text colour.
 * @param {string} [props.title] - Worth passing on anything that may not fit.
 * @param {boolean} [props.wrap] - Let the value wrap as a flex row.
 * @param {number} [props.span] - Columns to take, for a value needing two.
 */
export function StatField({ label, color, title, wrap, span, children }) {
  return (
    <Tooltip text={title}>
      <div
        // The stats' one structural hook, so a test can ask for a field by name
        // rather than matching the run-together text of a caption and its value.
        data-stat={label}
        style={{
          minWidth: 0,
          ...(span ? { gridColumn: `span ${span}` } : null),
        }}
      >
        <div style={{ ...STAT_LABEL_STYLE, color: color ?? C.dim }}>
          {label}
        </div>
        <div
          style={{
            fontSize: CONTENT_FONT_SIZE,
            lineHeight: 1.5,
            color: color ?? C.text,
            minWidth: 0,
            ...(wrap
              ? {
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                }
              : {
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }),
          }}
        >
          {children}
        </div>
      </div>
    </Tooltip>
  );
}

/**
 * A run of stats under a heading of their own — the withdrawal scores, which
 * are a reading of the element rather than a fact about it.
 *
 * @param {Object} props
 * @param {string} props.label
 */
export function StatSection({ label, children }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ ...STAT_LABEL_STYLE, color: C.dim, marginBottom: 2 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

/**
 * A named value with a bar drawn beside it: the change in one coherence measure
 * if this element were withdrawn.
 *
 * The number is what the reader acts on, so it is written out and the bar is
 * `aria-hidden` — it is there to make a column of these comparable at a glance,
 * which three decimal places on their own are not. Its length is the magnitude
 * against `scale`, which every bar in the panel shares, so what the lengths
 * compare is one element with the next. `title` is where the scale is named,
 * this being a bar with no visible axis.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {number} props.value
 * @param {string} props.text  - The value as it should read.
 * @param {number} props.scale - Full width, from {@link module:utils/withdrawalScale}.
 * @param {string} props.color - The bar's fill: a graph hue, read as colour.
 * @param {string} [props.textColor] - The number's ink, where that hue does not
 *   read as type on the panel. Defaults to the bar's own colour.
 * @param {string} [props.title]
 */
export function DeltaBar({
  label,
  value,
  text,
  scale,
  color,
  textColor,
  title,
}) {
  // Rounded before it reaches CSS: 0.132 / 0.2 × 100 is 66.00000000000001 in
  // binary floating point, and that goes into the style attribute verbatim.
  const pct =
    Math.round(Math.min(100, (Math.abs(value) / scale) * 100) * 100) / 100;
  return (
    <Tooltip text={title}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2.2fr) auto",
          alignItems: "center",
          gap: 8,
          fontSize: CONTENT_FONT_SIZE,
          lineHeight: 1.7,
        }}
      >
        <span
          style={{
            color: C.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        <span
          aria-hidden="true"
          style={{
            position: "relative",
            height: 6,
            borderRadius: 3,
            background: `${C.border}`,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${pct}%`,
              background: color,
              borderRadius: 3,
            }}
          />
        </span>
        <span
          style={{
            color: textColor ?? color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {text}
        </span>
      </div>
    </Tooltip>
  );
}

// ─── Details disclosure ───────────────────────────────────────────────────────

/**
 * The card's own "Hide details" control, on the rule that separates the claim
 * from everything said about it.
 *
 * The statement is what a reader scans a list of cards for; the stats are what
 * they look at once they have found one. Folding them away is how a panel of
 * two dozen cards stays a list of claims — and it is per card rather than a
 * global setting because it is the one card in hand that is being examined.
 *
 * The visible words are the accessible name (WCAG 2.5.3), the chevron is
 * decorative, and `aria-expanded` carries the state that the rotation shows.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Function} props.onToggle
 * @param {string} props.controls - Id of the region it opens.
 */
export function DetailsToggle({ open, onToggle, controls }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="tap-target"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "none",
        border: "none",
        padding: "2px 0",
        margin: 0,
        color: C.dim,
        cursor: "pointer",
        fontSize: 10,
        lineHeight: 1.6,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 9,
          display: "inline-block",
          transition: "transform 0.15s",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        }}
      >
        ▼
      </span>
      {open ? "Hide details" : "Show details"}
    </button>
  );
}

/**
 * The wording an item had before it was last revised, in a panel of the revised
 * colour.
 *
 * Its own block rather than a stat: it is a sentence, and the one piece of a
 * card's metadata that is as long as the claim above it. The heading carries the
 * round, which is why a revision needs no `Status` field beside it.
 *
 * @param {Object} props
 * @param {string} props.text
 * @param {number} [props.round]
 */
export function PreviousWording({ text, round }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "6px 8px",
        borderRadius: 4,
        background: `${C.revised}14`,
        border: `1px solid ${C.revised}33`,
      }}
    >
      <div style={{ ...STAT_LABEL_STYLE, color: C.revised, marginBottom: 2 }}>
        {round ? `Revised in round ${round} · ` : ""}Previous wording
      </div>
      <div
        style={{ fontSize: CONTENT_FONT_SIZE, color: C.dim, lineHeight: 1.6 }}
      >
        {text}
      </div>
    </div>
  );
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

/**
 * @param {Object}    props
 * @param {Function}  props.onRevise
 * @param {Function} [props.onWithdraw]
 * @param {Function} [props.onReinstate]
 * @param {boolean}  [props.compact]  Wide-screen size: the metadata chips' type
 *   scale rather than the panel's, so the header reads as one band. See
 *   {@link module:constants/textTabStyles.COMPACT_BTN_STYLE}. The graph's pinned
 *   -node tooltip leaves this off — there the buttons are the only thing in a
 *   small popover, with no chips to sit level with.
 */
export function ActionButtons({
  onRevise,
  onWithdraw,
  onReinstate,
  compact = false,
}) {
  const ghost = compact
    ? { ...GHOST_BTN_STYLE, ...COMPACT_BTN_STYLE }
    : GHOST_BTN_STYLE;
  const withdraw = compact
    ? { ...WITHDRAW_BTN_STYLE, ...COMPACT_BTN_STYLE }
    : WITHDRAW_BTN_STYLE;
  return (
    // Grouped and named: a card holds several buttons — the id badge among them
    // — and "Revise" on its own says nothing about what it revises.
    <div
      role="group"
      aria-label="Item actions"
      style={{ display: "flex", gap: 4, flexShrink: 0 }}
    >
      <button onClick={onRevise} className="tap-target" style={ghost}>
        Revise
      </button>
      {onWithdraw && (
        <button onClick={onWithdraw} className="tap-target" style={withdraw}>
          Withdraw
        </button>
      )}
      {onReinstate && (
        <button
          onClick={onReinstate}
          className="tap-target"
          style={{ ...ghost, color: C.supports }}
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
            fontSize: CONTENT_FONT_SIZE,
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
