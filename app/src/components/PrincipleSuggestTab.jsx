/**
 * @fileoverview Principle suggestion tab — asks the backend LLM to suggest new
 * principles that would systematise existing judgments, then lets the user
 * reject individual suggestions and save the rest in one go.
 * @module components/PrincipleSuggestTab
 */

/** @import { REState } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";
import { fetchPrincipleSuggestions } from "../utils/principlesClient.js";

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * @param {Object}           props
 * @param {number}           props.jAndPCount
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {number}           props.suggestionCount
 * @param {Function}         props.onSuggest
 * @param {Function}         props.onSaveAll
 * @param {Function}         props.onRejectAll
 * @param {string|undefined} props.model
 */
function Toolbar({
  jAndPCount,
  loading,
  hasResult,
  suggestionCount,
  onSuggest,
  onSaveAll,
  onRejectAll,
  model,
}) {
  const suggestDisabled = loading || jAndPCount < 1;
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
        Principle suggestions for{" "}
        <span style={{ color: C.text, fontWeight: "bold" }}>{jAndPCount}</span>{" "}
        judgments{model ? `, via ${model}` : ""}.
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {suggestionCount > 0 && (
          <>
            <button
              onClick={onSaveAll}
              style={{
                background: C.principle.high,
                border: "none",
                color: "#fff",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Save all
            </button>
            <button
              onClick={onRejectAll}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                color: C.dim,
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Reject all
            </button>
          </>
        )}
        <button
          onClick={onSuggest}
          disabled={suggestDisabled}
          style={{
            background: suggestDisabled ? C.border : C.supports,
            border: "none",
            color: "#fff",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: "bold",
            cursor: suggestDisabled ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Thinking…" : hasResult ? "Re-suggest" : "Suggest"}
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
 * A single suggestion card with Accept and Reject buttons.
 *
 * @param {Object}   props
 * @param {{text: string, confidence: string, covers: string[], explanation: string}} props.suggestion
 * @param {Function} props.onAccept
 * @param {Function} props.onReject
 */
function SuggestionCard({ suggestion, onAccept, onReject }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${C.principle.high}`,
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
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            flex: 1,
            fontWeight: "bold",
            color: C.text,
            lineHeight: 1.5,
          }}
        >
          {suggestion.text}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button
            onClick={onAccept}
            style={{
              background: C.principle.high,
              border: "none",
              color: "#fff",
              borderRadius: 4,
              padding: "2px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Accept
          </button>
          <button
            onClick={onReject}
            style={{
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
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: C.principle.high,
            border: `1px solid ${C.principle.high}`,
            borderRadius: 4,
            padding: "1px 6px",
          }}
        >
          {suggestion.confidence}
        </span>
        {suggestion.covers.length > 0 && (
          <span style={{ fontSize: 10, color: C.dim }}>
            covers: {suggestion.covers.join(", ")}
          </span>
        )}
      </div>
      <div style={{ color: C.dim, lineHeight: 1.6 }}>
        {suggestion.explanation}
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
export function PrincipleSuggestTab({ state, onAddElement, onLogRejections }) {
  /** @type {[Array<{text: string, confidence: string, covers: string[], explanation: string}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);

  const judgments = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.type === "judgment",
  );
  const principles = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.type === "principle",
  );

  const suggest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { suggestions: s, model: m } =
        await fetchPrincipleSuggestions(state);
      setSuggestions(s);
      setModel(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const accept = (suggestion) => {
    onAddElement({
      type: "principle",
      text: suggestion.text,
      confidence: suggestion.confidence,
      origin: "llm",
    });
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const reject = (suggestion) => {
    onLogRejections([suggestion.text]);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const saveAll = () => {
    suggestions.forEach((s) => {
      onAddElement({
        type: "principle",
        text: s.text,
        confidence: s.confidence,
        origin: "llm",
      });
    });
    setSuggestions([]);
  };

  const rejectAll = () => {
    onLogRejections(suggestions.map((s) => s.text));
    setSuggestions([]);
  };

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "0 4px 24px" }}>
      <Toolbar
        jAndPCount={judgments.length + principles.length}
        loading={loading}
        hasResult={suggestions !== null}
        suggestionCount={suggestions?.length ?? 0}
        onSuggest={suggest}
        onSaveAll={saveAll}
        onRejectAll={rejectAll}
        model={model}
      />

      {error && <ErrorBanner message={error} />}

      {judgments.length + principles.length <= 1 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          Add at least one non-withdrawn judgment or principle to suggest
          principles.
        </div>
      )}

      {suggestions !== null && suggestions.length === 0 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          No suggestions remaining.
        </div>
      )}

      {suggestions?.map((s, i) => (
        <SuggestionCard
          key={i}
          suggestion={s}
          onAccept={() => accept(s)}
          onReject={() => reject(s)}
        />
      ))}
    </div>
  );
}
