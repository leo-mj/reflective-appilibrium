/**
 * @fileoverview Judgment elicitation tab — asks the backend LLM to present
 * questions and thought experiments that may prompt the user to articulate
 * new moral judgments. The user can reject individual suggestions and save
 * the tentative judgments for the ones they find compelling.
 * @module components/JudgmentElicitTab
 */

/** @import { REState } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";
import { fetchJudgmentElicitations } from "../utils/judgmentsClient.js";

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * @param {Object}           props
 * @param {number}           props.elementCount
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {number}           props.suggestionCount
 * @param {Function}         props.onElicit
 * @param {Function}         props.onSaveAll
 * @param {string|undefined} props.model
 */
function Toolbar({
  elementCount,
  loading,
  hasResult,
  suggestionCount,
  onElicit,
  onSaveAll,
  model,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0 14px",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
        Judgment elicitation for{" "}
        <span style={{ color: C.text, fontWeight: "bold" }}>{elementCount}</span>{" "}
        elements{model ? `, via ${model}` : ""}.
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {suggestionCount > 0 && (
          <button
            onClick={onSaveAll}
            style={{
              background: C.judgment.high,
              border: "none",
              color: "#fff",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Save {suggestionCount}
          </button>
        )}
        <button
          onClick={onElicit}
          disabled={loading}
          style={{
            background: loading ? C.border : C.supports,
            border: "none",
            color: "#fff",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Thinking…" : hasResult ? "Re-elicit" : "Elicit"}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} props.message
 */
function ErrorBanner({ message }) {
  return (
    <div
      style={{
        background: "#7c1d1d44",
        border: "1px solid #dc2626",
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 12,
        color: "#fca5a5",
        marginBottom: 14,
      }}
    >
      {message}
    </div>
  );
}

/**
 * A single suggestion card showing the thought experiment and tentative judgment.
 *
 * @param {Object}   props
 * @param {{question: string, text: string, confidence: string}} props.suggestion
 * @param {Function} props.onReject
 */
function SuggestionCard({ suggestion, onReject }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${C.judgment.high}`,
        background: C.panel,
        borderRadius: "0 6px 6px 0",
        padding: "10px 14px",
        marginBottom: 10,
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ color: C.text, lineHeight: 1.6, fontStyle: "italic" }}>
          {suggestion.question}
        </div>
        <button
          onClick={onReject}
          style={{
            flexShrink: 0,
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.dim,
            borderRadius: 4,
            padding: "2px 10px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Reject
        </button>
      </div>
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 8,
          display: "flex",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: C.judgment.high,
            border: `1px solid ${C.judgment.high}`,
            borderRadius: 4,
            padding: "1px 6px",
            flexShrink: 0,
          }}
        >
          {suggestion.confidence}
        </span>
        <div style={{ color: C.dim, lineHeight: 1.6 }}>{suggestion.text}</div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Function} props.onAddElement
 */
export function JudgmentElicitTab({ state, onAddElement }) {
  /** @type {[Array<{question: string, text: string, confidence: string}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);

  const activeElements = state.elements.filter((e) => e.status !== "withdrawn");

  const elicit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { suggestions: s, model: m } = await fetchJudgmentElicitations(state);
      setSuggestions(s);
      setModel(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reject = (suggestion) => {
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const saveAll = () => {
    suggestions.forEach((s) => {
      onAddElement({
        type: "judgment",
        text: s.text,
        confidence: s.confidence,
        origin: "llm",
      });
    });
    setSuggestions([]);
  };

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "0 4px 24px" }}>
      <Toolbar
        elementCount={activeElements.length}
        loading={loading}
        hasResult={suggestions !== null}
        suggestionCount={suggestions?.length ?? 0}
        onElicit={elicit}
        onSaveAll={saveAll}
        model={model}
      />

      {error && <ErrorBanner message={error} />}

      {suggestions !== null && suggestions.length === 0 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          No suggestions remaining.
        </div>
      )}

      {suggestions?.map((s, i) => (
        <SuggestionCard key={i} suggestion={s} onReject={() => reject(s)} />
      ))}
    </div>
  );
}
