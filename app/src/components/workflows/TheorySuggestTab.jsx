/**
 * @fileoverview Background theory suggestion tab — asks the backend LLM for
 * theories that bear on the user's position, with the works they are developed
 * in, and lets the user accept, reject or modify each one.
 *
 * What selects a theory lives in the backend prompt: the strength of the reasons
 * for it, and its relevance to this topic and these elements. Deliberately *not*
 * what the position already presupposes — that is orthogonal to plausibility and
 * would rank a fringe commitment the user happens to require above a
 * well-supported theory they do not.
 *
 * A card is a theory and the works it is developed in, and deliberately says
 * nothing about how it relates to the elements already on the board. Which
 * relations hold is the Relations tab's business; annotating them here would
 * duplicate that tab and put the model's reading of a connection ahead of the
 * user's, which is the opposite of what an RE tool should do.
 *
 * It is the workflow's third phase, between the principles a theory has to bear
 * on and the two phases that connect what is on the board; see app/CLAUDE.md.
 *
 * @module components/TheorySuggestTab
 */

/** @import { REState } from '../../types.js' */

import { useEffect, useRef } from "react";
import { C } from "../../constants/colors.js";
import { fetchTheorySuggestions } from "../../utils/theoriesClient.js";
import { AddElementPanel } from "../user_edits/WorkflowAddPanels.jsx";
import { llmOrigin } from "../../utils/stateUtils.js";
import { useSuggestionWorkflow } from "../../hooks/useSuggestionWorkflow.js";
import { Citation, CITATION_CAVEAT } from "../Citation.jsx";
import {
  AcceptButton,
  RejectButton,
  ModifyButton,
  CancelButton,
  ModifyTextarea,
  ErrorBanner,
  AiDisclosureBanner,
} from "../SuggestionActions.jsx";
import { SuggestionToolbar } from "./workflowComponents.jsx";

/**
 * How a verified, unverified or unchecked reference is labelled.
 *
 * `not_found` gets no warning wording and no warning colour, and that is a
 * decision rather than an oversight: Crossref's coverage of philosophy
 * monographs is patchy, so a 1971 book may simply not be indexed. Presenting
 * "not found" as suspicion would flag the canon.
 *
 * `unchecked` is kept distinct from `not_found` for the same reason in the other
 * direction — "we could not look" is not "we looked and found nothing", and a
 * Crossref outage must not read as evidence against every reference at once.
 */
const VERIFICATION = {
  matched: {
    label: "found in Crossref",
    color: C.supports,
    title: "A work with these details exists. Whether it says what is claimed here is not checked.",
  },
  not_found: {
    label: "not found in Crossref",
    color: C.dim,
    title:
      "No matching record. Crossref does not index every book, so this is not by itself a sign the work is invented — look it up.",
  },
  unchecked: {
    label: "not checked",
    color: C.dim,
    title: "The reference could not be checked against Crossref.",
  },
};

/**
 * The works a suggested theory is attributed to.
 *
 * Renders nothing at all when there are none. An empty list is a permitted and
 * often preferable answer — requiring a citation per suggestion is how
 * fabricated ones are produced — so an empty heading here would present a good
 * outcome as a failure.
 *
 * @param {Object} props
 * @param {Array}  props.sources
 * @param {Function} [props.onRemove]  Shown while editing: see the note on
 *   removal in the accept path below.
 */
function Sources({ sources, onRemove }) {
  if (!sources?.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          fontSize: 10,
          color: C.dim,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        Sources
      </div>
      {sources.map((source, i) => {
        const state = VERIFICATION[source.verification] ?? VERIFICATION.unchecked;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              fontSize: 11,
              color: C.dim,
              marginBottom: 4,
            }}
          >
            <div style={{ flex: 1 }}>
              <Citation source={source} />{" "}
              <span title={state.title} style={{ color: state.color, whiteSpace: "nowrap" }}>
                · {state.label}
              </span>
            </div>
            {onRemove && (
              // Named directly rather than through `Tooltip`, which leaves a
              // trigger with visible text alone so as not to override what is on
              // screen (WCAG 2.5.3). "×" is a symbol rather than a text label,
              // so it has nothing to preserve — the same case as the "+" in
              // SectionHeader, which names itself the same way.
              <button
                onClick={() => onRemove(i)}
                aria-label="Remove this reference"
                title="Remove this reference"
                className="tap-target-square"
                style={{
                  background: "none",
                  border: "none",
                  color: C.dim,
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {Object}   props
 * @param {Object}   props.suggestion
 * @param {Object|null} props.draft  `{text, sources}` while editing, else null.
 */
function SuggestionCard({
  suggestion,
  draft,
  onAccept,
  onReject,
  onModify,
  onModifyChange,
  onRemoveSource,
  onModifyCancel,
}) {
  const isEditing = draft !== null;
  const sources = draft ? draft.sources : suggestion.sources;
  return (
    <div
      style={{
        borderLeft: `3px solid ${C.theory.accent}`,
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
            value={draft.text}
            onChange={onModifyChange}
            accentColor={C.theory.accent}
          />
        ) : (
          <div style={{ flex: 1, fontWeight: "bold", color: C.text, lineHeight: 1.5 }}>
            {suggestion.text}
          </div>
        )}
        <div
          style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
        >
          <AcceptButton onClick={onAccept} accentColor={C.theory.accent} />
          <RejectButton onClick={onReject} />
          {isEditing ? (
            <CancelButton onClick={onModifyCancel} />
          ) : (
            <ModifyButton onClick={onModify} />
          )}
        </div>
      </div>
      <Sources sources={sources} onRemove={isEditing ? onRemoveSource : undefined} />
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
export function TheorySuggestTab({
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
  } = useSuggestionWorkflow(fetchTheorySuggestions);

  // A background theory bears on principles first of all, which is why this
  // phase runs after the one that suggests them; with nothing to bear on there
  // is nothing for one to do.
  const principles = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.status !== "rejected" && e.type === "principle",
  );

  const suggest = () => run(state, useDummy);

  // The principle count gates the auto-fetch as well as the button. Every other
  // phase asking with nothing to work from wastes an LLM call; this one would
  // spend a round of Crossref lookups on top of it, and on suggestions the tab
  // has already said it cannot make.
  const autoFetchRef = useRef(autoFetch);
  useEffect(() => {
    if (autoFetchRef.current && !suggestionsDisabled && principles.length >= 1)
      suggest();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** What would be accepted right now: the draft when editing, else the suggestion. */
  const resolved = (suggestion) =>
    editing?.suggestion === suggestion
      ? editing.draft
      : { text: suggestion.text, sources: suggestion.sources };

  /**
   * `verification` is response-only and is dropped here.
   *
   * A verdict is a snapshot that goes stale as Crossref indexes more, whereas
   * the DOI a match yielded is a fact. A stored reference carrying a DOI is one
   * that verified — which says the same thing and cannot rot.
   */
  const strip = (sources) =>
    (sources ?? []).map(({ verification, ...rest }) => rest); // eslint-disable-line no-unused-vars

  const accept = (suggestion) => {
    const { text, sources } = resolved(suggestion);
    const wasEdited =
      editing?.suggestion === suggestion &&
      (editing.draft.text !== suggestion.text ||
        editing.draft.sources.length !== suggestion.sources.length);
    onAddElement({
      type: "theory",
      text,
      confidence: suggestion.confidence,
      origin: llmOrigin(wasEdited, model),
      ...(sources.length ? { sources: strip(sources) } : {}),
    });
    setEditing(null);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  const reject = (suggestion) => {
    onRejectElements([
      {
        type: "theory",
        text: resolved(suggestion).text,
        confidence: suggestion.confidence,
        origin: "llm",
      },
    ]);
    setEditing(null);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <SuggestionToolbar
          tab="suggestTheories"
          title="Suggest Background Theories"
          actionLabel="Suggest"
          rerunLabel="Re-suggest"
          suggestionCount={hasResult ? suggestions.length : null}
          loading={loading}
          hasResult={hasResult}
          onRun={suggest}
          model={model}
          disabled={suggestionsDisabled}
          workflowPhase={workflowPhase}
          advanceWorkflow={onAdvanceWorkflow}
          nextPhaseIsEnabled={nextPhaseIsEnabled}
          needs={
            principles.length < 1
              ? "Add at least one principle first; a background theory is what grounds one."
              : undefined
          }
          disclosure={
            hasResult &&
            suggestions.length > 0 && (
              <AiDisclosureBanner
                model={model}
                note={`Review carefully before accepting. ${CITATION_CAVEAT}`}
              />
            )
          }
        />
        {error && <ErrorBanner message={error} />}

        {principles.length < 1 && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least one principle to suggest background theories — a theory
            is what grounds a principle, or what puts pressure on one.
          </div>
        )}

        {hasResult && suggestions.length === 0 && (
          <div style={{ fontSize: 12, color: C.dim }}>No suggestions remaining.</div>
        )}

        {suggestions?.map((s, i) => (
          <SuggestionCard
            key={i}
            suggestion={s}
            draft={editing?.suggestion === s ? editing.draft : null}
            onAccept={() => accept(s)}
            onReject={() => reject(s)}
            onModify={() =>
              setEditing({
                suggestion: s,
                draft: { text: s.text, sources: [...(s.sources ?? [])] },
              })
            }
            onModifyChange={(text) =>
              setEditing((prev) => ({ ...prev, draft: { ...prev.draft, text } }))
            }
            // Removal only, and only while editing. A user who rewrites the
            // theory can otherwise leave it carrying a reference that no longer
            // supports what it now says — and `origin` records only *that* an
            // edit happened, not which parts still stand behind it. Editing a
            // reference in place is deliberately not offered: it invites
            // correcting a fabricated citation into a plausible one.
            onRemoveSource={(index) =>
              setEditing((prev) => ({
                ...prev,
                draft: {
                  ...prev.draft,
                  sources: prev.draft.sources.filter((_, j) => j !== index),
                },
              }))
            }
            onModifyCancel={() => setEditing(null)}
          />
        ))}
      </div>
      <AddElementPanel elementType="theory" onAddElement={onAddElement} />
    </div>
  );
}
