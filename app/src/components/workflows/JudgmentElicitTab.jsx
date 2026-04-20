/**
 * @fileoverview Judgment elicitation tab — asks the backend LLM to present
 * questions and thought experiments that may prompt the user to articulate
 * new moral judgments. Each question comes with multiple jointly exhaustive
 * positions; the user accepts the ones they agree with and rejects the rest.
 * @module components/JudgmentElicitTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useEffect } from "react";
import { C } from "../../constants/colors.js";
import { fetchJudgmentElicitations } from "../../utils/judgmentsClient.js";
import { AddElementPanel } from "../user_edits/TextTabAddPanel.jsx";
import {
  AcceptButton,
  RejectButton,
  ModifyButton,
  CancelButton,
  ModifyTextarea,
  ErrorBanner,
} from "../SuggestionActions.jsx";
import { ProgressWorkflowBtn } from "./workflowComponents.jsx";
import { ConversationPanel } from "./ConversationPanel.jsx";

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * @param {Object}           props
 * @param {number}           props.elementCount
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {number}           props.suggestionCount
 * @param {Function}         props.onElicit
 * @param {Function}         props.onSaveAll
 * @param {Function}         props.onRejectAll
 * @param {string|undefined} props.model
 */
function Toolbar({
  elementCount,
  loading,
  hasResult,
  suggestionCount,
  onElicit,
  onSaveAll,
  onRejectAll,
  model,
  workflowPhase,
  advanceWorkflow,
  nextPhaseIsEnabled,
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
        <span style={{ color: C.text, fontWeight: "bold" }}>
          {elementCount}
        </span>{" "}
        elements{model ? `, via ${model}` : ""}.
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
 * A single suggestion card showing a thought experiment and its multiple
 * possible positions. Each position can be accepted, rejected, or modified
 * inline before a decision is made.
 *
 * @param {Object}   props
 * @param {{question: string, judgments: Array<{text: string, confidence: string}>}} props.suggestion
 * @param {{judgment: Object, draft: string}|null} props.editing
 *   The judgment currently being edited and its draft text, or null.
 * @param {Function} props.onAcceptJudgment   Called with the judgment object.
 * @param {Function} props.onRejectJudgment   Called with the judgment object.
 * @param {Function} props.onModify           Called with the judgment object to start editing.
 * @param {Function} props.onModifyChange     Called with the new draft string.
 * @param {Function} props.onModifyCancel     Called when the user cancels editing.
 */
function SuggestionCard({
  suggestion,
  editing,
  state,
  onAcceptJudgment,
  onRejectJudgment,
  onModify,
  onModifyChange,
  onModifyCancel,
}) {
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
          color: C.text,
          lineHeight: 1.6,
          fontStyle: "italic",
          marginBottom: 8,
        }}
      >
        {suggestion.question}
      </div>
      {suggestion.judgments.map((j, i) => {
        const isEditing = editing?.judgment === j;
        return (
          <div
            key={i}
            style={{
              borderTop: `1px solid ${C.border}`,
              paddingTop: 7,
              paddingBottom: 7,
              display: "flex",
              alignItems: isEditing ? "flex-start" : "baseline",
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
                marginTop: isEditing ? 4 : 0,
              }}
            >
              {j.confidence}
            </span>
            {isEditing ? (
              <ModifyTextarea
                value={editing.draft}
                onChange={onModifyChange}
                accentColor={C.judgment.high}
              />
            ) : (
              <div style={{ color: C.dim, lineHeight: 1.6, flex: 1 }}>
                {j.text}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 4,
                flexShrink: 0,
                marginTop: isEditing ? 2 : 0,
              }}
            >
              <AcceptButton
                onClick={() => onAcceptJudgment(j)}
                accentColor={C.judgment.high}
              />
              <RejectButton onClick={() => onRejectJudgment(j)} />
              {isEditing ? (
                <CancelButton onClick={onModifyCancel} />
              ) : (
                <ModifyButton onClick={() => onModify(j)} />
              )}
            </div>
          </div>
        );
      })}
      <ConversationPanel state={state} suggestion={suggestion} />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Removes one judgment option from its parent suggestion, dropping the suggestion if empty. */
function removeJudgment(suggestions, suggestion, judgment) {
  return suggestions
    .map((s) =>
      s === suggestion
        ? { ...s, judgments: s.judgments.filter((j) => j !== judgment) }
        : s,
    )
    .filter((s) => s.judgments.length > 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Function} props.onAddElement
 * @param {Function} props.onRejectElements
 */
export function JudgmentElicitTab({
  state,
  onAddElement,
  onRejectElements,
  autoFetch,
  workflowPhase,
  onAdvanceWorkflow,
  nextPhaseIsEnabled,
  useDummy = false,
}) {
  /** @type {[Array<{question: string, judgments: Array<{text: string, confidence: string}>}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  /** @type {[{suggestion: Object, judgment: Object, draft: string}|null, Function]} */
  const [editing, setEditing] = useState(null);

  const activeElements = state.elements.filter((e) => e.status !== "withdrawn");

  const elicit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { suggestions: s, model: m } =
        await fetchJudgmentElicitations(state, useDummy);
      setSuggestions(s);
      setModel(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) elicit();
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedText = (judgment) =>
    editing?.judgment === judgment ? editing.draft : judgment.text;

  const accept = (suggestion, judgment) => {
    onAddElement({
      type: "judgment",
      text: resolvedText(judgment),
      confidence: judgment.confidence,
      origin: "llm",
    });
    setEditing(null);
    setSuggestions((prev) => removeJudgment(prev, suggestion, judgment));
  };

  const reject = (suggestion, judgment) => {
    onRejectElements([
      {
        type: "judgment",
        text: resolvedText(judgment),
        confidence: judgment.confidence,
        origin: "llm",
      },
    ]);
    setEditing(null);
    setSuggestions((prev) => removeJudgment(prev, suggestion, judgment));
  };

  const saveAll = () => {
    suggestions.forEach((s) =>
      s.judgments.forEach((j) =>
        onAddElement({
          type: "judgment",
          text: resolvedText(j),
          confidence: j.confidence,
          origin: "llm",
        }),
      ),
    );
    setEditing(null);
    setSuggestions([]);
  };

  const rejectAll = () => {
    if (!suggestions?.length) return;
    const all = suggestions.flatMap((s) =>
      s.judgments.map((j) => ({
        type: "judgment",
        text: resolvedText(j),
        confidence: j.confidence,
        origin: "llm",
      })),
    );
    onRejectElements(all);
    setEditing(null);
    setSuggestions([]);
  };
  const remainingJudgments =
    suggestions?.reduce((n, s) => n + s.judgments.length, 0) ?? 0;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <Toolbar
          elementCount={activeElements.length}
          loading={loading}
          hasResult={suggestions !== null}
          suggestionCount={remainingJudgments}
          onElicit={elicit}
          onSaveAll={saveAll}
          onRejectAll={rejectAll}
          model={model}
          workflowPhase={workflowPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
        />
        {error && <ErrorBanner message={error} />}

        {suggestions !== null && suggestions.length === 0 && (
          <div style={{ fontSize: 12, color: C.dim }}>
            No suggestions remaining.
          </div>
        )}

        {suggestions?.map((s, i) => (
          <SuggestionCard
            key={i}
            suggestion={s}
            editing={editing?.suggestion === s ? editing : null}
            state={state}
            onAcceptJudgment={(j) => accept(s, j)}
            onRejectJudgment={(j) => reject(s, j)}
            onModify={(j) =>
              setEditing({ suggestion: s, judgment: j, draft: j.text })
            }
            onModifyChange={(text) =>
              setEditing((prev) => ({ ...prev, draft: text }))
            }
            onModifyCancel={() => setEditing(null)}
          />
        ))}
      </div>
      <AddElementPanel elementType="judgment" onAddElement={onAddElement} />
    </div>
  );
}
