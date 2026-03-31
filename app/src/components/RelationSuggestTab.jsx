/**
 * @fileoverview Relation suggestion tab — asks the backend LLM to identify
 * relations between existing elements, then lets the user reject individual
 * suggestions and save the rest in one go.
 * @module components/RelationSuggestTab
 */

/** @import { REState } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";
import { fetchRelationSuggestions } from "../utils/relationsClient.js";

// ─── Colour helper ────────────────────────────────────────────────────────────

const REL_COLOR = {
  supports: C.supports,
  conflicts: C.conflicts,
  undermines: C.undermines,
  depends: C.depends,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * @param {Object}           props
 * @param {number}           props.elementCount
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {number}           props.suggestionCount
 * @param {Function}         props.onSuggest
 * @param {Function}         props.onSaveAll
 * @param {string|undefined} props.model
 */
function Toolbar({
  elementCount,
  loading,
  hasResult,
  suggestionCount,
  onSuggest,
  onSaveAll,
  onRejectAll,
  model,
}) {
  const suggestDisabled = loading || elementCount < 2;
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
        Relation suggestions for{" "}
        <span style={{ color: C.text, fontWeight: "bold" }}>
          {elementCount}
        </span>{" "}
        elements{model ? `, via ${model}` : ""}.
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
 * @param {{from: string, to: string, type: string, explanation: string}} props.suggestion
 * @param {Function} props.onAccept
 * @param {Function} props.onReject
 */
function SuggestionCard({ suggestion, onAccept, onReject }) {
  const color = REL_COLOR[suggestion.type] ?? C.dim;
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
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
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontWeight: "bold", color: C.text }}>
          {suggestion.from}
        </span>
        <span style={{ color: C.dim }}>→</span>
        <span style={{ fontWeight: "bold", color: C.text }}>
          {suggestion.to}
        </span>
        <span
          style={{
            color,
            fontSize: 11,
            border: `1px solid ${color}`,
            borderRadius: 4,
            padding: "1px 6px",
          }}
        >
          {suggestion.type}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
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
 * @param {Function} props.onAddRelation
 */
export function RelationSuggestTab({
  state,
  onAddRelation,
  onScrollToRelations,
  onLogRejections,
}) {
  /** @type {[Array<{from: string, to: string, type: string, explanation: string}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);

  const activeElements = state.elements.filter((e) => e.status !== "withdrawn");

  const suggest = async () => {
    onScrollToRelations?.();
    setLoading(true);
    setError(null);
    try {
      const { suggestions: s, model: m } =
        await fetchRelationSuggestions(state);
      setSuggestions(s);
      setModel(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const accept = (suggestion) => {
    onAddRelation(
      {
        from: suggestion.from,
        to: suggestion.to,
        type: suggestion.type,
        explanation: suggestion.explanation,
      },
      { select: false },
    );
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const reject = (suggestion) => {
    onLogRejections([`${suggestion.from} → ${suggestion.to} (${suggestion.type})`]);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const saveAll = () => {
    suggestions.forEach((s) => {
      onAddRelation(
        { from: s.from, to: s.to, type: s.type, explanation: s.explanation },
        { select: false },
      );
    });
    setSuggestions([]);
  };

  const rejectAll = () => {
    onLogRejections(suggestions.map((s) => `${s.from} → ${s.to} (${s.type})`));
    setSuggestions([]);
  };

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "0 4px 24px" }}>
      <Toolbar
        elementCount={activeElements.length}
        loading={loading}
        hasResult={suggestions !== null}
        suggestionCount={suggestions?.length ?? 0}
        onSuggest={suggest}
        onSaveAll={saveAll}
        onRejectAll={rejectAll}
        model={model}
      />

      {error && <ErrorBanner message={error} />}

      {activeElements.length < 2 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          Add at least two non-withdrawn elements to suggest relations.
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
