/**
 * @fileoverview Display sub-components for the RE simulation result view.
 * All purely presentational — no async calls, no simulation state.
 * @module components/SimulateRethonCards
 */

import { Fragment } from "react";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { SCORE_MEASURES } from "../../constants/scoreMeasures.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function elementColor(type) {
  return type === "judgment"
    ? C.judgment.accent
    : type === "principle"
      ? C.principle.accent
      : C.theory.accent;
}

// ─── SectionHead ──────────────────────────────────────────────────────────────

export function SectionHead({ title, count }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: "bold",
        color: C.dim,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        margin: "16px 0 8px",
      }}
    >
      {title}
      {count != null && (
        <span style={{ fontWeight: "normal" }}> · {count}</span>
      )}
    </div>
  );
}

// ─── ChangeList ───────────────────────────────────────────────────────────────

/**
 * One kind of change accepting would make — withdrawn, taken up, rejected —
 * with each element's wording, since these few are what the reader decides
 * on. Nothing at all when the list is empty: an empty heading is noise.
 *
 * @param {{ title: string, hint?: string, elements: Object[], color: string }} props
 */
export function ChangeList({ title, hint, elements, color }) {
  if (!elements.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: "bold", color, marginBottom: 4 }}>
        {title} · {elements.length}
        {hint && (
          <span style={{ fontWeight: "normal", color: C.dim }}> — {hint}</span>
        )}
      </div>
      {/* One grid for the whole list rather than a row each, so the badges
          share a column as wide as the widest of them and every statement
          starts at the same place, J4's as J13's. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "max-content minmax(0, 1fr)",
          alignItems: "baseline",
          columnGap: 6,
          rowGap: 3,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {elements.map((e) => (
          <Fragment key={e.id}>
            <IdBadge element={e} />
            <span style={{ color: C.text }}>{e.text}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── IdBadge ──────────────────────────────────────────────────────────────────

export function IdBadge({ element }) {
  const negated = element.negated;
  const color = elementColor(element.type);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: "bold",
        color: negated ? C.dim : color,
        border: `1px solid ${negated ? C.border : color}`,
        borderRadius: 4,
        padding: "1px 5px",
        // Stretched to its column in a list, the id sits in the middle of the
        // wider badge; inline elsewhere, this does nothing.
        textAlign: "center",
      }}
    >
      {negated ? "¬" : ""}
      {element.id}
    </span>
  );
}

export function elementLabel(element) {
  return element.negated ? `not ${element.text}` : element.text;
}

// ─── ArgumentCard ─────────────────────────────────────────────────────────────

export function ArgumentCard({ argument }) {
  const conclusion = argument.at(-1);
  const premises = argument.slice(0, -1);
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "7px 10px",
        marginBottom: 6,
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        {premises.map((p, i) => (
          <span
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <IdBadge element={p} />
            {i < premises.length - 1 && <span style={{ color: C.dim }}>+</span>}
          </span>
        ))}
        <span style={{ color: C.dim }}>→</span>
        <IdBadge element={conclusion} />
      </div>
      <div style={{ color: C.dim, lineHeight: 1.5 }}>
        {premises.map((p) => elementLabel(p)).join(" + ")}
        <span style={{ color: C.dim }}> → </span>
        {elementLabel(conclusion)}
      </div>
    </div>
  );
}

// ─── ScoreRow ─────────────────────────────────────────────────────────────────

/**
 * Display achievement (Z) + component scores in a compact inline row.
 * When `stepType` is provided only the scores that changed at that step are shown:
 *   - theory step      → Z, Account, Systematicity
 *   - commitments step → Z, Account, Faithfulness
 *   - null (summary)   → all four
 */
export function ScoreRow({ scores, highlight = false, stepType = null }) {
  if (!scores) return null;
  const fmt = (v) => v.toFixed(3);
  const ACCENT = C.principle.accent;
  const allEntries = [
    { key: "z", value: scores.z, color: highlight ? ACCENT : C.dim },
    { key: "account", value: scores.account, color: C.judgment.accent },
    {
      key: "systematicity",
      value: scores.systematicity,
      color: C.principle.accent,
    },
    {
      key: "faithfulness",
      value: scores.faithfulness,
      color: C.theory.accent,
    },
  ].map((e) => ({ ...e, ...SCORE_MEASURES[e.key] }));
  const entries = allEntries.filter(({ key }) => {
    if (!stepType) return true;
    if (key === "systematicity" && stepType === "commitments") return false;
    if (key === "faithfulness" && stepType === "theory") return false;
    return true;
  });
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        fontSize: 11,
        color: C.dim,
        flexWrap: "wrap",
      }}
    >
      {entries.map(({ label, tooltip, value, color }) => (
        <span key={label}>
          {/* The four names mean nothing to a reader who has not met rethon,
              and this row is where they are first seen. */}
          <Tooltip text={tooltip}>
            <span style={{ color, fontWeight: "bold" }}>{label}</span>
          </Tooltip>{" "}
          <span style={{ color: highlight ? C.text : C.dim }}>
            {fmt(value)}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── StepRow ──────────────────────────────────────────────────────────────────

/** One side of a step: an element that came in or went out, its wording on hover. */
function StepChange({ element, sign, color }) {
  return (
    <Tooltip text={elementLabel(element)}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        <span style={{ color, fontWeight: "bold" }}>{sign}</span>
        <IdBadge element={element} />
      </span>
    </Tooltip>
  );
}

/**
 * A step of the simulation as what it changed — `stepChanges` in
 * utils/simulationDiff.js — rather than the whole position it arrived at,
 * which repeated nearly all of the one before. Pressing it shows that step on
 * the graph.
 *
 * @param {Object}   props
 * @param {{ index: number, kind: string, joined: Object[], left: Object[] }} props.step
 * @param {Object|null} props.score   - The scores at this step; none at step 0.
 * @param {boolean}  props.current    - Whether the graph is showing this step.
 * @param {() => void} props.onSelect
 */
export function StepRow({ step, score, current, onSelect }) {
  const isCommitments = step.kind === "commitments";
  // The tag draws its border in the fill tone and its word in the text tone:
  // at 10px bold the fill tone does not clear AA on the panel.
  const tagColor = isCommitments ? C.judgment.accent : C.principle.accent;
  const tagText = isCommitments ? C.judgment.text : C.principle.text;
  const unchanged = !step.joined.length && !step.left.length;
  const quiet =
    step.index === 0
      ? "The elements you accept and reject now"
      : step.index === 1 && unchanged
        ? "Your active principles and background theories"
        : unchanged
          ? "No change"
          : null;
  return (
    <div role="listitem">
      <button
        onClick={onSelect}
        aria-pressed={current}
        aria-label={`Show step ${step.index} on the graph`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          fontSize: 11,
          padding: "4px 6px",
          marginBottom: 2,
          borderRadius: 4,
          border: `1px solid ${current ? C.border : "transparent"}`,
          background: current ? C.panel : "transparent",
          color: C.text,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            color: C.dim,
            minWidth: 18,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {step.index}
        </span>
        <span
          style={{
            color: tagText,
            border: `1px solid ${tagColor}`,
            borderRadius: 3,
            padding: "0 4px",
            fontSize: 10,
            fontWeight: "bold",
            flexShrink: 0,
            minWidth: 72,
            textAlign: "center",
          }}
        >
          {isCommitments ? "Elements" : "Theory"}
        </span>
        <span
          style={{
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            color: C.dim,
          }}
        >
          {quiet ?? (
            <>
              {step.joined.map((e) => (
                <StepChange
                  key={`+${e.negated ? "¬" : ""}${e.id}`}
                  element={e}
                  sign="+"
                  color={C.supportsText}
                />
              ))}
              {step.left.map((e) => (
                <StepChange
                  key={`-${e.negated ? "¬" : ""}${e.id}`}
                  element={e}
                  sign="−"
                  color={C.conflicts}
                />
              ))}
            </>
          )}
        </span>
        {score && (
          <Tooltip text={SCORE_MEASURES.z.tooltip}>
            <span style={{ color: C.dim, flexShrink: 0 }}>
              Z {score.z.toFixed(3)}
            </span>
          </Tooltip>
        )}
      </button>
    </div>
  );
}
