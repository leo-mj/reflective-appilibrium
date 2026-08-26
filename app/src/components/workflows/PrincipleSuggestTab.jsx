/**
 * @fileoverview Principle suggestion tab — asks the backend LLM to suggest new
 * principles that would systematise existing judgments, then lets the user
 * accept, reject, or modify individual suggestions before saving.
 * @module components/PrincipleSuggestTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useEffect, useRef } from "react";
import { C } from "../../constants/colors.js";
import { fetchPrincipleSuggestions } from "../../utils/principlesClient.js";
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
import { nextPhaseEnabled } from "../../utils/workflowUtils.js";
import {
  ScoreDeltaBadge,
  SuggestionToolbar,
} from "./workflowComponents.jsx";
import { ConversationPanel } from "./ConversationPanel.jsx";
import { confidenceLabel } from "../../utils/confidenceLabel.js";

/**
 * A single principle suggestion card. The principle text can be modified inline
 * before accepting.
 *
 * @param {Object}   props
 * @param {{text: string, confidence: number, covers: string[], explanation: string}} props.suggestion
 * @param {string|null} props.draft  Current draft text when editing, null otherwise.
 * @param {Function} props.onAccept
 * @param {Function} props.onReject
 * @param {Function} props.onModify
 * @param {Function} props.onModifyChange  Called with the new draft string.
 * @param {Function} props.onModifyCancel
 * @param {boolean}  [props.suggestionsAreSample]  These suggestions came from the
 *   sample fixtures; hides the AI discussion affordance, which has no sample
 *   path and would issue a live LLM call.
 */
function SuggestionCard({
  suggestion,
  draft,
  state,
  baseline,
  weights,
  onAccept,
  onReject,
  onModify,
  onModifyChange,
  onModifyCancel,
  suggestionsAreSample = false,
}) {
  const isEditing = draft !== null;
  const [convOpen, setConvOpen] = useState(false);
  return (
    <div
      style={{
        borderLeft: `3px solid ${C.principle.accent}`,
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
        {isEditing ? (
          <ModifyTextarea
            value={draft}
            onChange={onModifyChange}
            accentColor={C.principle.accent}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <ScoreDeltaBadge
            state={state}
            text={draft ?? suggestion.text}
            type="principle"
            confidence={suggestion.confidence}
            baseline={baseline}
            weights={weights}
          />
          <AcceptButton onClick={onAccept} accentColor={C.principle.accent} />
          <RejectButton onClick={onReject} />
          {isEditing ? (
            <CancelButton onClick={onModifyCancel} />
          ) : (
            <ModifyButton onClick={onModify} />
          )}
          {!suggestionsAreSample && (
            <ChatButton
              isOpen={convOpen}
              accentColor={C.principle.accent}
              onClick={() => setConvOpen((o) => !o)}
            />
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
          title={confidenceLabel(suggestion.confidence).title}
          style={{
            fontSize: 10,
            lineHeight: 1,
            color: C.principle.text,
            border: `1px solid ${C.principle.accent}`,
            borderRadius: 4,
            padding: "3px 6px",
          }}
        >
          {confidenceLabel(suggestion.confidence).text}
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
      {!suggestionsAreSample && convOpen && (
        <ConversationPanel state={state} suggestion={suggestion} />
      )}
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
    editing,
    setEditing,
    hasResult,
    run,
  } = useSuggestionWorkflow(fetchPrincipleSuggestions);
  const baseline = useScoreBaseline(state, weights);

  const judgments = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.type === "judgment",
  );
  const principles = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.type === "principle",
  );
  const jAndPCount = judgments.length + principles.length;

  const suggest = () => run(state, useDummy);

  const autoFetchRef = useRef(autoFetch);
  useEffect(() => {
    if (autoFetchRef.current && !suggestionsDisabled) suggest();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedText = (suggestion) =>
    editing?.suggestion === suggestion ? editing.draft : suggestion.text;

  const accept = (suggestion) => {
    const wasEdited =
      editing?.suggestion === suggestion && editing.draft !== suggestion.text;
    onAddElement({
      type: "principle",
      text: resolvedText(suggestion),
      confidence: suggestion.confidence,
      origin: llmOrigin(wasEdited, model),
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

  const nextPhaseIsEnabled = nextPhaseEnabled(workflowPhase, state);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <SuggestionToolbar
          tab="suggestPrinciples"
          title="Suggest Principles"
          actionLabel="Suggest"
          rerunLabel="Re-suggest"
          suggestionCount={hasResult ? suggestions.length : null}
          loading={loading}
          hasResult={hasResult}
          onRun={suggest}
          model={model}
          disabled={suggestionsDisabled}
          needs={
            jAndPCount < 1 ? "Add a judgment or principle first." : undefined
          }
          workflowPhase={workflowPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
        />
        {error && <ErrorBanner message={error} />}
        {hasResult && suggestions.length > 0 && (
          <AiDisclosureBanner model={model} />
        )}

        {jAndPCount <= 1 && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least one non-withdrawn judgment or principle to suggest
            principles.
          </div>
        )}

        {hasResult && suggestions.length === 0 && (
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
            baseline={baseline}
            weights={weights}
            onAccept={() => accept(s)}
            onReject={() => reject(s)}
            onModify={() => setEditing({ suggestion: s, draft: s.text })}
            onModifyChange={(text) =>
              setEditing((prev) => ({ ...prev, draft: text }))
            }
            onModifyCancel={() => setEditing(null)}
            suggestionsAreSample={suggestionsAreSample}
          />
        ))}
      </div>
      <AddElementPanel elementType="principle" onAddElement={onAddElement} />
    </div>
  );
}
