/**
 * @fileoverview Principle suggestion tab — asks the backend LLM to suggest new
 * principles that would systematise existing judgments, then lets the user
 * accept, reject, or modify individual suggestions before saving.
 * @module components/PrincipleSuggestTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useEffect, useRef } from "react";
import { C } from "../../constants/colors.js";
import { quickScore } from "../../utils/simulateRethonClient.js";
import { SpinnerIcon } from "../Icons.jsx";
import { fetchPrincipleSuggestions } from "../../utils/principlesClient.js";
import { AddElementPanel } from "../user_edits/WorkflowAddPanels.jsx";
import { Tooltip } from "../Tooltip.jsx";
import { sendsToLlmText } from "../../utils/openaiClient.js";
import { llmOrigin } from "../../utils/stateUtils.js";
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
  nextPhaseEnabled,
  WORKFLOW_NEXT_PHASE,
} from "../../utils/workflowUtils.js";
import { ProgressWorkflowBtn, ScoreDeltaBadge } from "./workflowComponents.jsx";
import { ConversationPanel } from "./ConversationPanel.jsx";

/**
 * @param {Object}           props
 * @param {number}           props.jAndPCount   Used to disable the button; not shown in label.
 * @param {number|null}      props.suggestionCount  Remaining suggestions, or null if not yet fetched.
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {Function}         props.onSuggest
 * @param {string|undefined} props.model
 */
function Toolbar({
  jAndPCount,
  suggestionCount,
  loading,
  hasResult,
  onSuggest,
  model,
  workflowPhase,
  advanceWorkflow,
  nextPhaseIsEnabled,
  suggestionsDisabled,
}) {
  const suggestDisabled = loading || jAndPCount < 1 || suggestionsDisabled;
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
        <span style={{ color: C.principle.high, fontWeight: "bold" }}>
          Suggest Principles
        </span>
        {suggestionCount !== null && (
          <span style={{ color: C.dim }}> · {suggestionCount} remaining</span>
        )}
        {model && <span style={{ color: C.dim }}> · {model}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <Tooltip text={sendsToLlmText()}>
          <button
            onClick={onSuggest}
            disabled={suggestDisabled}
            style={{
              background: "transparent",
              border: `1px solid ${suggestDisabled ? C.border : C.principle.high}`,
              color: suggestDisabled ? C.dim : C.principle.high,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: "bold",
              cursor: suggestDisabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {loading ? <SpinnerIcon /> : <span>↺</span>}
            {loading ? "Thinking…" : hasResult ? "Re-suggest" : "Suggest"}
          </button>
        </Tooltip>
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
}) {
  const isEditing = draft !== null;
  const [convOpen, setConvOpen] = useState(false);
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
          <AcceptButton onClick={onAccept} accentColor={C.principle.high} />
          <RejectButton onClick={onReject} />
          {isEditing ? (
            <CancelButton onClick={onModifyCancel} />
          ) : (
            <ModifyButton onClick={onModify} />
          )}
          <ChatButton
            isOpen={convOpen}
            accentColor={C.principle.high}
            onClick={() => setConvOpen((o) => !o)}
          />
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
            lineHeight: 1,
            color: C.principle.high,
            border: `1px solid ${C.principle.high}`,
            borderRadius: 4,
            padding: "3px 6px",
          }}
        >
          {typeof suggestion.confidence === "number"
            ? suggestion.confidence.toFixed(2)
            : suggestion.confidence}
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
      {convOpen && <ConversationPanel state={state} suggestion={suggestion} />}
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
  suggestionsDisabled = false,
  weights = null,
}) {
  /** @type {[Array<{text: string, confidence: string, covers: string[], explanation: string}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  /** @type {[{suggestion: Object, draft: string}|null, Function]} */
  const [editing, setEditing] = useState(null);

  // Baseline account + systematicity for the current state.
  const [baseline, setBaseline] = useState(null);
  useEffect(() => {
    let cancelled = false;
    quickScore(state.elements, state.relations, weights).then((scores) => {
      if (!cancelled) setBaseline(scores ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [state.elements, state.relations, weights]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Toolbar
          jAndPCount={judgments.length + principles.length}
          suggestionCount={suggestions !== null ? suggestions.length : null}
          loading={loading}
          hasResult={suggestions !== null}
          onSuggest={suggest}
          model={model}
          workflowPhase={workflowPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
          suggestionsDisabled={suggestionsDisabled}
        />
        {error && <ErrorBanner message={error} />}
        {suggestions !== null && suggestions.length > 0 && (
          <AiDisclosureBanner model={model} />
        )}

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
            baseline={baseline}
            weights={weights}
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
