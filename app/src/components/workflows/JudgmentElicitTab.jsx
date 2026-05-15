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
import { SpinnerIcon } from "../Icons.jsx";
import { fetchJudgmentElicitations } from "../../utils/judgmentsClient.js";
import { AddElementPanel } from "../user_edits/TextTabAddPanel.jsx";
import {
  AcceptButton,
  RejectButton,
  ModifyButton,
  CancelButton,
  ChatButton,
  ModifyTextarea,
  ErrorBanner,
} from "../SuggestionActions.jsx";
import { ProgressWorkflowBtn } from "./workflowComponents.jsx";
import { ConversationPanel } from "./ConversationPanel.jsx";

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * @param {Object}           props
 * @param {number|null}      props.suggestionCount  Remaining suggestions, or null if not yet fetched.
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {Function}         props.onElicit
 * @param {string|undefined} props.model
 */
function Toolbar({
  suggestionCount,
  loading,
  hasResult,
  onElicit,
  model,
  workflowPhase,
  advanceWorkflow,
  nextPhaseIsEnabled,
  suggestionsDisabled,
}) {
  const buttonDisabled = loading || suggestionsDisabled;
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
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <span style={{ color: C.judgment.high, fontWeight: "bold" }}>
          Elicit Judgments
        </span>
        {suggestionCount !== null && (
          <span style={{ color: C.dim }}> · {suggestionCount} remaining</span>
        )}
        {model && <span style={{ color: C.dim }}> · {model}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <button
          onClick={onElicit}
          disabled={buttonDisabled}
          style={{
            background: "transparent",
            border: `1px solid ${buttonDisabled ? C.border : C.judgment.high}`,
            color: buttonDisabled ? C.dim : C.judgment.high,
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: "bold",
            cursor: buttonDisabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {loading ? <SpinnerIcon /> : <span>↺</span>}
          {loading ? "Thinking…" : hasResult ? "Re-elicit" : "Elicit"}
        </button>
        {workflowPhase && (
          <>
            <div
              style={{
                width: 1,
                height: 18,
                background: C.border,
                margin: "0 8px",
              }}
            />
            <ProgressWorkflowBtn
              nextPhaseIsEnabled={nextPhaseIsEnabled}
              workflowPhase={workflowPhase}
              advanceWorkflow={advanceWorkflow}
            />
          </>
        )}
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
  const [hovered, setHovered] = useState(null);
  const [convOpen, setConvOpen] = useState({});

  return (
    <div
      style={{
        borderLeft: `3px solid ${C.judgment.high}`,
        background: C.panel,
        borderRadius: "0 6px 6px 0",
        marginBottom: 10,
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          color: C.dim,
          lineHeight: 1.6,
          fontStyle: "italic",
          padding: "8px 14px",
          borderBottom: `1px solid ${C.border}`,
          background: C.judgment.high + "10",
        }}
      >
        {suggestion.question}
      </div>
      {suggestion.judgments.map((j, i) => {
        const isEditing = editing?.judgment === j;
        const isConvOpen = convOpen[i];
        const isHovered = hovered === i;
        return (
          <div key={i}>
            <div
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                padding: "8px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                background:
                  isHovered && !isEditing
                    ? C.judgment.high + "08"
                    : "transparent",
                transition: "background 0.12s",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  lineHeight: 1,
                  color: C.judgment.high,
                  border: `1px solid ${C.judgment.high}`,
                  borderRadius: 4,
                  padding: "3px 6px",
                  flexShrink: 0,
                  marginTop: 3,
                  width: "7em",
                  textAlign: "center",
                  display: "inline-block",
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
                <div style={{ color: C.text, lineHeight: 1.6, flex: 1 }}>
                  {j.text}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexShrink: 0,
                  alignSelf: "flex-start",
                  marginTop: 2,
                  opacity: isHovered || isEditing || isConvOpen ? 1 : 0.2,
                  transition: "opacity 0.12s",
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
                <ChatButton
                  isOpen={isConvOpen}
                  accentColor={C.judgment.high}
                  onClick={() => setConvOpen((o) => ({ ...o, [i]: !o[i] }))}
                />
              </div>
            </div>
            {isConvOpen && (
              <ConversationPanel
                state={state}
                suggestion={{ question: suggestion.question, ...j }}
              />
            )}
          </div>
        );
      })}
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
  suggestionsDisabled = false,
}) {
  /** @type {[Array<{question: string, judgments: Array<{text: string, confidence: string}>}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  /** @type {[{suggestion: Object, judgment: Object, draft: string}|null, Function]} */
  const [editing, setEditing] = useState(null);

  const elicit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { suggestions: s, model: m } = await fetchJudgmentElicitations(
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

  useEffect(() => {
    if (autoFetch && !suggestionsDisabled) elicit();
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedText = (judgment) =>
    editing?.judgment === judgment ? editing.draft : judgment.text;

  const accept = (suggestion, judgment) => {
    onAddElement({
      type: "judgment",
      text: resolvedText(judgment),
      confidence: judgment.confidence,
      origin: "llm",
      ...(judgment.index != null && { questionnaireIndex: judgment.index }),
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

  const remainingJudgments =
    suggestions !== null
      ? suggestions.reduce((n, s) => n + s.judgments.length, 0)
      : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <Toolbar
          suggestionCount={remainingJudgments}
          loading={loading}
          hasResult={suggestions !== null}
          onElicit={elicit}
          model={model}
          workflowPhase={workflowPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
          suggestionsDisabled={suggestionsDisabled}
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
