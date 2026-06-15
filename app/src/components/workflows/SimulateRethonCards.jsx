/**
 * @fileoverview Display sub-components for the RE simulation result view.
 * All purely presentational — no async calls, no simulation state.
 * @module components/SimulateRethonCards
 */

import { C } from "../../constants/colors.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function elementColor(type) {
  return type === "judgment"
    ? C.judgment.high
    : type === "principle"
      ? C.principle.high
      : C.theory.high;
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

// ─── ElementRow ───────────────────────────────────────────────────────────────

export function ElementRow({ element, faded = false }) {
  const color = elementColor(element.type);
  return (
    <div
      style={{
        borderLeft: `3px solid ${faded ? C.border : color}`,
        padding: "6px 10px",
        marginBottom: 6,
        background: C.panel,
        borderRadius: "0 4px 4px 0",
        opacity: faded ? 0.5 : 1,
      }}
    >
      <span
        style={{
          color: faded ? C.dim : color,
          fontWeight: "bold",
          fontSize: 11,
          marginRight: 6,
        }}
      >
        {element.id}
      </span>
      <span style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>
        {element.text}
      </span>
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
 * Display Z + component scores in a compact inline row.
 * When `stepType` is provided only the scores that changed at that step are shown:
 *   - theory step      → Z, Account, Systematicity
 *   - commitments step → Z, Account, Faithfulness
 *   - null (summary)   → all four
 */
export function ScoreRow({ scores, highlight = false, stepType = null }) {
  if (!scores) return null;
  const fmt = (v) => v.toFixed(3);
  const ACCENT = C.principle.high;
  const allEntries = [
    { key: "z", label: "Z-Score", value: scores.z, color: highlight ? ACCENT : C.dim },
    { key: "account", label: "Account", value: scores.account, color: C.judgment.high },
    { key: "systematicity", label: "Systematicity", value: scores.systematicity, color: C.principle.high },
    { key: "faithfulness", label: "Faithfulness", value: scores.faithfulness, color: C.theory.high },
  ];
  const entries = allEntries.filter(({ key }) => {
    if (!stepType) return true;
    if (key === "systematicity" && stepType === "commitments") return false;
    if (key === "faithfulness" && stepType === "theory") return false;
    return true;
  });
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.dim, flexWrap: "wrap" }}>
      {entries.map(({ label, value, color }) => (
        <span key={label}>
          <span style={{ color, fontWeight: "bold" }}>{label}</span>{" "}
          <span style={{ color: highlight ? C.text : C.dim }}>{fmt(value)}</span>
        </span>
      ))}
    </div>
  );
}

// ─── EvolutionStep ────────────────────────────────────────────────────────────

export function EvolutionStep({ step, stepType, position, scores }) {
  const isCommitments = stepType === "commitments";
  const typeColor = isCommitments ? C.judgment.high : C.principle.high;
  const typeLabel = isCommitments ? "C" : "T";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 6,
        fontSize: 11,
      }}
    >
      <span
        style={{
          color: C.dim,
          minWidth: 16,
          textAlign: "right",
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        {step}
      </span>
      <span
        title={isCommitments ? "Commitments position" : "Theory position"}
        style={{
          color: typeColor,
          border: `1px solid ${typeColor}`,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 10,
          fontWeight: "bold",
          lineHeight: "17px",
          flexShrink: 0,
          opacity: 0.75,
        }}
      >
        {typeLabel}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: scores ? 4 : 0,
          }}
        >
          {position.length === 0 ? (
            <span style={{ color: C.dim }}>∅</span>
          ) : (
            position.map((e, i) => <IdBadge key={i} element={e} />)
          )}
        </div>
        <ScoreRow scores={scores} stepType={stepType} />
      </div>
    </div>
  );
}
