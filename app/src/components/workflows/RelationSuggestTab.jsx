/**
 * @fileoverview Relation suggestion tab — asks the backend LLM to identify
 * relations between existing elements, then lets the user accept, reject, or
 * modify the explanation of individual suggestions before saving.
 * @module components/RelationSuggestTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useEffect, useRef } from "react";
import { C } from "../../constants/colors.js";
import { fetchRelationSuggestions } from "../../utils/relationsClient.js";
import { AddRelationPanel } from "../user_edits/WorkflowAddPanels.jsx";
import {
  llmOrigin,
  relationTypeLabel,
  linkableElements,
} from "../../utils/stateUtils.js";
import { useSuggestionWorkflow } from "../../hooks/useSuggestionWorkflow.js";
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
import { SuggestionToolbar } from "./workflowComponents.jsx";
import { ConversationPanel } from "./ConversationPanel.jsx";

// ─── Colour helper ────────────────────────────────────────────────────────────

const REL_COLOR = {
  supports: C.supports,
  conflicts: C.conflicts,
  undermines: C.undermines,
  depends: C.depends,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single relation suggestion card. The explanation can be modified inline
 * before accepting.
 *
 * @param {Object}   props
 * @param {{from: string, to: string, type: string, explanation: string}} props.suggestion
 * @param {string|null} props.draft  Current draft explanation when editing, null otherwise.
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
  onAccept,
  onReject,
  onModify,
  onModifyChange,
  onModifyCancel,
  suggestionsAreSample = false,
}) {
  const color = REL_COLOR[suggestion.type] ?? C.dim;
  const isEditing = draft !== null;
  const [convOpen, setConvOpen] = useState(false);
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
          {relationTypeLabel(suggestion.type)}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <AcceptButton onClick={onAccept} accentColor={C.supports} />
          <RejectButton onClick={onReject} />
          {isEditing ? (
            <CancelButton onClick={onModifyCancel} />
          ) : (
            <ModifyButton onClick={onModify} />
          )}
          {!suggestionsAreSample && (
            <ChatButton
              isOpen={convOpen}
              accentColor={color}
              onClick={() => setConvOpen((o) => !o)}
            />
          )}
        </div>
      </div>
      {isEditing ? (
        <ModifyTextarea
          value={draft}
          onChange={onModifyChange}
          accentColor={color}
        />
      ) : (
        <div style={{ color: C.dim, lineHeight: 1.6 }}>
          {suggestion.explanation}
        </div>
      )}
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
 * @param {Function} props.onAddRelation
 * @param {Function} props.onScrollToRelations
 * @param {Function} props.onRejectRelations
 */
export function RelationSuggestTab({
  state,
  onAddRelation,
  onScrollToRelations,
  onRejectRelations,
  autoFetch,
  workflowPhase,
  workflowNextPhase,
  onAdvanceWorkflow,
  useDummy = false,
  suggestionsAreSample = false,
  suggestionsDisabled = false,
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
  } = useSuggestionWorkflow(fetchRelationSuggestions);

  const activeElements = state.elements.filter((e) => e.status !== "withdrawn");

  const suggest = ({ scroll = true } = {}) => {
    if (scroll) onScrollToRelations?.();
    return run(state, useDummy);
  };

  const autoFetchRef = useRef(autoFetch);
  useEffect(() => {
    if (autoFetchRef.current && !suggestionsDisabled)
      suggest({ scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedExplanation = (suggestion) =>
    editing?.suggestion === suggestion ? editing.draft : suggestion.explanation;

  const accept = (suggestion) => {
    const wasEdited =
      editing?.suggestion === suggestion &&
      editing.draft !== suggestion.explanation;
    onAddRelation(
      {
        from: suggestion.from,
        to: suggestion.to,
        type: suggestion.type,
        explanation: resolvedExplanation(suggestion),
        origin: llmOrigin(wasEdited, model),
      },
      { select: false },
    );
    setEditing(null);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const reject = (suggestion) => {
    onRejectRelations([
      {
        from: suggestion.from,
        to: suggestion.to,
        type: suggestion.type,
        explanation: resolvedExplanation(suggestion),
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
          tab="suggestRelations"
          title="Suggest Relations"
          actionLabel="Suggest"
          rerunLabel="Re-suggest"
          suggestionCount={hasResult ? suggestions.length : null}
          loading={loading}
          hasResult={hasResult}
          onRun={suggest}
          model={model}
          disabled={suggestionsDisabled}
          needs={
            activeElements.length < 2
              ? "Add at least two elements first."
              : undefined
          }
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

        {activeElements.length < 2 && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least two non-withdrawn elements to suggest relations.
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
            onAccept={() => accept(s)}
            onReject={() => reject(s)}
            onModify={() => setEditing({ suggestion: s, draft: s.explanation })}
            onModifyChange={(text) =>
              setEditing((prev) => ({ ...prev, draft: text }))
            }
            onModifyCancel={() => setEditing(null)}
            suggestionsAreSample={suggestionsAreSample}
          />
        ))}
      </div>
      {/* Not `activeElements`: that gates what the model is asked about, while
          the panel is the user's own hand-built relation. */}
      <AddRelationPanel
        elements={linkableElements(state.elements)}
        onAddRelation={onAddRelation}
      />
    </div>
  );
}
