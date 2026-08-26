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
import { AddElementPanel } from "../user_edits/WorkflowAddPanels.jsx";
import { llmOrigin } from "../../utils/stateUtils.js";
import { useSuggestionWorkflow } from "../../hooks/useSuggestionWorkflow.js";
import { useScoreBaseline } from "../../hooks/useScoreBaseline.js";
import {
  AcceptButton,
  RejectButton,
  ModifyButton,
  CancelButton,
  ChatButton,
  ModifyTextarea,
  ErrorBanner,
  AiDisclosureBanner,
} from "../SuggestionActions.jsx";
import {
  ScoreDeltaBadge,
  SuggestionToolbar,
} from "./workflowComponents.jsx";
import { ConversationPanel } from "./ConversationPanel.jsx";
import { confidenceLabel } from "../../utils/confidenceLabel.js";

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single suggestion card showing a thought experiment and its multiple
 * possible positions. Each position can be accepted, rejected, or modified
 * inline before a decision is made.
 *
 * @param {Object}   props
 * @param {{question: string, judgments: Array<{text: string, confidence: number}>}} props.suggestion
 * @param {{judgment: Object, draft: string}|null} props.editing
 *   The judgment currently being edited and its draft text, or null.
 * @param {Function} props.onAcceptJudgment   Called with the judgment object.
 * @param {Function} props.onRejectJudgment   Called with the judgment object.
 * @param {Function} props.onModify           Called with the judgment object to start editing.
 * @param {Function} props.onModifyChange     Called with the new draft string.
 * @param {Function} props.onModifyCancel     Called when the user cancels editing.
 * @param {boolean}  [props.suggestionsAreSample]  These suggestions came from the
 *   sample fixtures; hides the AI discussion affordance, which has no sample
 *   path and would issue a live LLM call.
 */
function SuggestionCard({
  suggestion,
  editing,
  state,
  baseline,
  weights,
  onAcceptJudgment,
  onRejectJudgment,
  onModify,
  onModifyChange,
  onModifyCancel,
  suggestionsAreSample = false,
}) {
  const [hovered, setHovered] = useState(null);
  const [convOpen, setConvOpen] = useState({});

  return (
    <div
      style={{
        borderLeft: `3px solid ${C.judgment.accent}`,
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
          background: C.judgment.accent + "10",
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
                    ? C.judgment.accent + "08"
                    : "transparent",
                transition: "background 0.12s",
              }}
            >
              <span
                title={confidenceLabel(j.confidence).title}
                style={{
                  fontSize: 10,
                  lineHeight: 1,
                  color: C.judgment.text,
                  border: `1px solid ${C.judgment.accent}`,
                  borderRadius: 4,
                  padding: "3px 6px",
                  flexShrink: 0,
                  marginTop: 3,
                  width: "7em",
                  textAlign: "center",
                  display: "inline-block",
                }}
              >
                {confidenceLabel(j.confidence).text}
              </span>
              {isEditing ? (
                <ModifyTextarea
                  value={editing.draft}
                  onChange={onModifyChange}
                  accentColor={C.judgment.accent}
                />
              ) : (
                <div style={{ color: C.text, lineHeight: 1.6, flex: 1 }}>
                  {j.text}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                  alignSelf: "flex-start",
                  marginTop: 2,
                  opacity: isHovered || isEditing || isConvOpen ? 1 : 0.2,
                  transition: "opacity 0.12s",
                }}
              >
                <ScoreDeltaBadge
                  state={state}
                  text={isEditing ? editing.draft : j.text}
                  type="judgment"
                  confidence={j.confidence}
                  baseline={baseline}
                  weights={weights}
                />
                <AcceptButton
                  onClick={() => onAcceptJudgment(j)}
                  accentColor={C.judgment.accent}
                />
                <RejectButton onClick={() => onRejectJudgment(j)} />
                {isEditing ? (
                  <CancelButton onClick={onModifyCancel} />
                ) : (
                  <ModifyButton onClick={() => onModify(j)} />
                )}
                {!suggestionsAreSample && (
                  <ChatButton
                    isOpen={isConvOpen}
                    accentColor={C.judgment.accent}
                    onClick={() => setConvOpen((o) => ({ ...o, [i]: !o[i] }))}
                  />
                )}
              </div>
            </div>
            {!suggestionsAreSample && isConvOpen && (
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
  workflowNextPhase,
  onAdvanceWorkflow,
  nextPhaseIsEnabled,
  useDummy = false,
  suggestionsAreSample = false,
  suggestionsDisabled = false,
  weights = null,
}) {
  const {
    suggestions,
    setSuggestions,
    loading,
    error,
    model,
    /** @type {{suggestion: Object, judgment: Object, draft: string}|null} */
    editing,
    setEditing,
    hasResult,
    run,
  } = useSuggestionWorkflow(fetchJudgmentElicitations);
  const baseline = useScoreBaseline(state, weights);

  const elicit = () => run(state, useDummy);

  useEffect(() => {
    if (autoFetch && !suggestionsDisabled) elicit();
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedText = (judgment) =>
    editing?.judgment === judgment ? editing.draft : judgment.text;

  const accept = (suggestion, judgment) => {
    const wasEdited =
      editing?.judgment === judgment && editing.draft !== judgment.text;
    onAddElement({
      type: "judgment",
      text: resolvedText(judgment),
      confidence: judgment.confidence,
      origin: llmOrigin(wasEdited, model),
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

  // Counted across questions, not per question: what is left to decide is the
  // number of options, and one question may hold several.
  const remainingJudgments = hasResult
    ? suggestions.reduce((n, s) => n + s.judgments.length, 0)
    : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <SuggestionToolbar
          tab="elicitJudgments"
          title="Elicit Judgments"
          actionLabel="Elicit"
          rerunLabel="Re-elicit"
          suggestionCount={remainingJudgments}
          loading={loading}
          hasResult={hasResult}
          onRun={elicit}
          model={model}
          disabled={suggestionsDisabled}
          workflowPhase={workflowPhase}
          nextPhase={workflowNextPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
          disclosure={
            hasResult &&
            suggestions.length > 0 && <AiDisclosureBanner model={model} />
          }
        />
        {error && <ErrorBanner message={error} />}

        {hasResult && suggestions.length === 0 && (
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
            baseline={baseline}
            weights={weights}
            onAcceptJudgment={(j) => accept(s, j)}
            onRejectJudgment={(j) => reject(s, j)}
            onModify={(j) =>
              setEditing({ suggestion: s, judgment: j, draft: j.text })
            }
            onModifyChange={(text) =>
              setEditing((prev) => ({ ...prev, draft: text }))
            }
            onModifyCancel={() => setEditing(null)}
            suggestionsAreSample={suggestionsAreSample}
          />
        ))}
      </div>
      <AddElementPanel elementType="judgment" onAddElement={onAddElement} />
    </div>
  );
}
