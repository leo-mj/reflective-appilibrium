/**
 * @fileoverview Principle suggestion tab — asks the backend LLM to suggest new
 * principles that would systematise existing judgments, then lets the user
 * accept, reject, or modify individual suggestions before saving.
 * @module components/PrincipleSuggestTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../../constants/colors.js";
import { fetchPrincipleSuggestions } from "../../utils/principlesClient.js";
import { AddElementPanel } from "../user_edits/TextTabAddPanel.jsx";
import {
  AcceptButton,
  RejectButton,
  ModifyButton,
  CancelButton,
  ModifyTextarea,
  ErrorBanner,
} from "../SuggestionActions.jsx";
import {
  nextPhaseEnabled,
  WORKFLOW_NEXT_PHASE,
} from "../../utils/workflowUtils.js";
import { ProgressWorkflowBtn } from "./workflowComponents.jsx";
import { ConversationPanel } from "./ConversationPanel.jsx";

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
  workflowPhase,
  advanceWorkflow,
  nextPhaseIsEnabled,
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
        Principle suggestions based on{" "}
        <span style={{ color: C.text, fontWeight: "bold" }}>{jAndPCount}</span>{" "}
        judgments and principles{model ? `, via ${model}` : ""}.
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <ProgressWorkflowBtn
          nextPhaseIsEnabled={nextPhaseIsEnabled}
          workflowPhase={workflowPhase}
          advanceWorkflow={advanceWorkflow}
        />
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
                background: "#dc2626",
                border: "none",
                color: "#fff",
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
 * A single principle suggestion card. The principle text can be modified inline
 * before accepting.
 *
 * @param {Object}   props
 * @param {{text: string, confidence: string, covers: string[], explanation: string}} props.suggestion
 * @param {string|null} props.draft  Current draft text when editing, null otherwise.
 * @param {Function} props.onAccept
 * @param {Function} props.onReject
 * @param {Function} props.onModify
 * @param {Function} props.onModifyChange  Called with the new draft string.
 * @param {Function} props.onModifyCancel
 */
function SuggestionCard({
  suggestion,
  draft,
  state,
  onAccept,
  onReject,
  onModify,
  onModifyChange,
  onModifyCancel,
}) {
  const isEditing = draft !== null;
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
          alignItems: isEditing ? "flex-start" : "flex-start",
          gap: 8,
          marginBottom: 6,
        }}
      >
        {isEditing ? (
          <ModifyTextarea
            value={draft}
            onChange={onModifyChange}
            accentColor={C.principle.high}
          />
        ) : (
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
        )}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <AcceptButton onClick={onAccept} accentColor={C.principle.high} />
          <RejectButton onClick={onReject} />
          {isEditing ? (
            <CancelButton onClick={onModifyCancel} />
          ) : (
            <ModifyButton onClick={onModify} />
          )}
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
      <ConversationPanel state={state} suggestion={suggestion} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Function} props.onAddElement
 * @param {Function} props.onRejectElements
 */
export function PrincipleSuggestTab({
  state,
  onAddElement,
  onRejectElements,
  autoFetch,
  workflowPhase,
  onAdvanceWorkflow,
  useDummy = false,
}) {
  /** @type {[Array<{text: string, confidence: string, covers: string[], explanation: string}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  /** @type {[{suggestion: Object, draft: string}|null, Function]} */
  const [editing, setEditing] = useState(null);

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
      const { suggestions: s, model: m } = await fetchPrincipleSuggestions(
        state,
        useDummy,
      );
      setSuggestions(s);
      setModel(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const autoFetchRef = useRef(autoFetch);
  useEffect(() => {
    if (autoFetchRef.current) suggest();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedText = (suggestion) =>
    editing?.suggestion === suggestion ? editing.draft : suggestion.text;

  const accept = (suggestion) => {
    onAddElement({
      type: "principle",
      text: resolvedText(suggestion),
      confidence: suggestion.confidence,
      origin: "llm",
    });
    setEditing(null);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const reject = (suggestion) => {
    onRejectElements([
      {
        type: "principle",
        text: resolvedText(suggestion),
        confidence: suggestion.confidence,
        origin: "llm",
      },
    ]);
    setEditing(null);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const saveAll = () => {
    suggestions.forEach((s) =>
      onAddElement({
        type: "principle",
        text: resolvedText(s),
        confidence: s.confidence,
        origin: "llm",
      }),
    );
    setEditing(null);
    setSuggestions([]);
  };

  const rejectAll = useCallback(() => {
    if (!suggestions?.length) return;
    onRejectElements(
      suggestions.map((s) => ({
        type: "principle",
        text: editing?.suggestion === s ? editing.draft : s.text,
        confidence: s.confidence,
        origin: "llm",
      })),
    );
    setEditing(null);
    setSuggestions([]);
  }, [suggestions, editing, onRejectElements]);

  const nextPhaseIsEnabled = nextPhaseEnabled(workflowPhase, state);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <Toolbar
          jAndPCount={judgments.length + principles.length}
          loading={loading}
          hasResult={suggestions !== null}
          suggestionCount={suggestions?.length ?? 0}
          onSuggest={suggest}
          onSaveAll={saveAll}
          onRejectAll={rejectAll}
          model={model}
          workflowPhase={workflowPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
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
            draft={editing?.suggestion === s ? editing.draft : null}
            state={state}
            onAccept={() => accept(s)}
            onReject={() => reject(s)}
            onModify={() => setEditing({ suggestion: s, draft: s.text })}
            onModifyChange={(text) =>
              setEditing((prev) => ({ ...prev, draft: text }))
            }
            onModifyCancel={() => setEditing(null)}
          />
        ))}
      </div>
      <AddElementPanel elementType="principle" onAddElement={onAddElement} />
    </div>
  );
}
