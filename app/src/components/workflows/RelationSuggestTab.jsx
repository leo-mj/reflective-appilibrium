/**
 * @fileoverview Relation suggestion tab — asks the backend LLM to identify
 * relations between existing elements, then lets the user accept, reject, or
 * modify the explanation of individual suggestions before saving.
 * @module components/RelationSuggestTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useEffect, useRef } from "react";
import { C } from "../../constants/colors.js";
import { SpinnerIcon } from "../Icons.jsx";
import { fetchRelationSuggestions } from "../../utils/relationsClient.js";
import { AddRelationPanel } from "../user_edits/TextTabAddPanel.jsx";
import {
  AcceptButton,
  RejectButton,
  ModifyButton,
  CancelButton,
  ChatButton,
  ModifyTextarea,
  ErrorBanner,
} from "../SuggestionActions.jsx";
import {
  nextPhaseEnabled,
  WORKFLOW_NEXT_PHASE,
} from "../../utils/workflowUtils.js";
import { ProgressWorkflowBtn } from "./workflowComponents.jsx";
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
 * @param {Object}           props
 * @param {number}           props.elementCount   Used to disable the button; not shown in label.
 * @param {number|null}      props.suggestionCount  Remaining suggestions, or null if not yet fetched.
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {Function}         props.onSuggest
 * @param {string|undefined} props.model
 */
function Toolbar({
  elementCount,
  suggestionCount,
  loading,
  hasResult,
  onSuggest,
  model,
  workflowPhase,
  advanceWorkflow,
  nextPhaseIsEnabled,
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
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <span style={{ color: C.supports, fontWeight: "bold" }}>
          Suggest Relations
        </span>
        {suggestionCount !== null && (
          <span style={{ color: C.dim }}> · {suggestionCount} remaining</span>
        )}
        {model && <span style={{ color: C.dim }}> · {model}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <button
          onClick={onSuggest}
          disabled={suggestDisabled}
          style={{
            background: "transparent",
            border: `1px solid ${suggestDisabled ? C.border : C.supports}`,
            color: suggestDisabled ? C.dim : C.supports,
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
          {suggestion.type}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <AcceptButton onClick={onAccept} accentColor={C.supports} />
          <RejectButton onClick={onReject} />
          {isEditing ? (
            <CancelButton onClick={onModifyCancel} />
          ) : (
            <ModifyButton onClick={onModify} />
          )}
          <ChatButton
            isOpen={convOpen}
            accentColor={color}
            onClick={() => setConvOpen((o) => !o)}
          />
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
      {convOpen && <ConversationPanel state={state} suggestion={suggestion} />}
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
  onAdvanceWorkflow,
  useDummy = false,
}) {
  /** @type {[Array<{from: string, to: string, type: string, explanation: string}>|null, Function]} */
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  /** @type {[{suggestion: Object, draft: string}|null, Function]} */
  const [editing, setEditing] = useState(null);

  const activeElements = state.elements.filter((e) => e.status !== "withdrawn");

  const suggest = async ({ scroll = true } = {}) => {
    if (scroll) onScrollToRelations?.();
    setLoading(true);
    setError(null);
    try {
      const { suggestions: s, model: m } = await fetchRelationSuggestions(
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
    if (autoFetchRef.current) suggest({ scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedExplanation = (suggestion) =>
    editing?.suggestion === suggestion ? editing.draft : suggestion.explanation;

  const accept = (suggestion) => {
    onAddRelation(
      {
        from: suggestion.from,
        to: suggestion.to,
        type: suggestion.type,
        explanation: resolvedExplanation(suggestion),
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
        <Toolbar
          elementCount={activeElements.length}
          suggestionCount={suggestions !== null ? suggestions.length : null}
          loading={loading}
          hasResult={suggestions !== null}
          onSuggest={suggest}
          model={model}
          workflowPhase={workflowPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
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
            draft={editing?.suggestion === s ? editing.draft : null}
            state={state}
            onAccept={() => accept(s)}
            onReject={() => reject(s)}
            onModify={() => setEditing({ suggestion: s, draft: s.explanation })}
            onModifyChange={(text) =>
              setEditing((prev) => ({ ...prev, draft: text }))
            }
            onModifyCancel={() => setEditing(null)}
          />
        ))}
      </div>
      <AddRelationPanel
        elements={activeElements}
        onAddRelation={onAddRelation}
      />
    </div>
  );
}
