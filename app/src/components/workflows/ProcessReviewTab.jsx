/**
 * @fileoverview Process review tab — asks the backend LLM to read the whole RE
 * process and report what it amounts to, then lets the user accept, reject, or
 * modify that reading before it is saved.
 *
 * An assist tab, because it is an AI task, but deliberately **not** a workflow
 * phase: the workflow's four tabs loop to build the position, and this one steps
 * back and looks at it. That is why no `workflowPhase` or `autoFetch` reaches
 * here — see the note in {@link module:components/GraphPanel} and the guard in
 * `workflowUtils.test.js`.
 *
 * Reviews accumulate rather than replace. A later run is given the earlier ones
 * (they travel inside the state) and asked to say what has moved since, so the
 * series reads as a commentary on the process's own development.
 *
 * @module components/ProcessReviewTab
 */

/** @import { REState, REReview } from '../../types.js' */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { fetchProcessReview } from "../../utils/reviewClient.js";
import { llmOrigin, reviewsOf } from "../../utils/stateUtils.js";
import { useSuggestionWorkflow } from "../../hooks/useSuggestionWorkflow.js";
import { Tooltip } from "../Tooltip.jsx";
import { TrashIcon } from "../Icons.jsx";
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
 * The four prose parts, in reading order. `headline` is handled separately: it
 * titles the review rather than sitting among its sections.
 */
const PARTS = [
  ["arc", "How the position moved"],
  ["surprises", "Surprising turns"],
  ["missed", "Missed opportunities"],
  ["method", "How the process was conducted"],
];

/** Every field the model fills in, headline included. */
const FIELDS = ["headline", ...PARTS.map(([key]) => key)];

/** The word budget the prompt asks the model to stay inside. */
const WORD_TARGET = 500;

function wordCount(review) {
  return FIELDS.reduce(
    (n, key) =>
      n + (review[key]?.trim() ? review[key].trim().split(/\s+/).length : 0),
    0,
  );
}

// ─── Presentation ─────────────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: "bold",
        color: C.text,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The five parts of one review. Shared by the pending candidate and the saved
 * entries, so an accepted review reads exactly as it did before acceptance.
 *
 * @param {Object} props
 * @param {Object} props.review
 * @param {Object|null} [props.draft] Per-field draft text while editing, or null.
 * @param {Function} [props.onDraftChange] Called with (field, text).
 */
function ReviewBody({ review, draft = null, onDraftChange }) {
  return (
    <>
      {PARTS.map(([key, label]) => {
        const text = draft ? draft[key] : review[key];
        if (!draft && !text) return null;
        return (
          <div key={key} style={{ marginBottom: 12 }}>
            <SectionHeading>{label}</SectionHeading>
            {draft ? (
              <ModifyTextarea
                value={text ?? ""}
                onChange={(next) => onDraftChange(key, next)}
                accentColor={C.text}
              />
            ) : (
              <div
                style={{
                  color: C.dim,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {text}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * The review the model has just returned, before the user has decided about it.
 */
function CandidateCard({
  review,
  draft,
  onAccept,
  onReject,
  onModify,
  onDraftChange,
  onModifyCancel,
}) {
  const shown = draft ? { ...review, ...draft } : review;
  const words = wordCount(shown);
  return (
    <div
      style={{
        borderLeft: `3px solid ${C.text}`,
        background: C.panel,
        borderRadius: "0 6px 6px 0",
        padding: "12px 14px",
        marginBottom: 14,
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {draft ? (
          <ModifyTextarea
            value={draft.headline ?? ""}
            onChange={(next) => onDraftChange("headline", next)}
            accentColor={C.text}
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
            {review.headline}
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
          <AcceptButton onClick={onAccept} accentColor={C.supports} />
          <RejectButton onClick={onReject} />
          {draft ? (
            <CancelButton onClick={onModifyCancel} />
          ) : (
            <ModifyButton onClick={onModify} />
          )}
        </div>
      </div>
      <ReviewBody review={review} draft={draft} onDraftChange={onDraftChange} />
      <div
        style={{
          fontSize: 10,
          color: words > WORD_TARGET ? C.undermines : C.dim,
          borderTop: `1px solid ${C.border}`,
          paddingTop: 8,
        }}
      >
        {words} words
        {words > WORD_TARGET && ` · over the ${WORD_TARGET}-word target`}
      </div>
    </div>
  );
}

/**
 * One accepted review in the list, collapsed to its headline until opened.
 *
 * @param {Object} props
 * @param {REReview} props.review
 * @param {boolean} props.isOpen
 * @param {Function} props.onToggle
 * @param {Function} props.onDiscard
 * @param {number} props.currentRound Where the process has since got to.
 */
function SavedReview({ review, isOpen, onToggle, onDiscard, currentRound }) {
  const stale = review.round < currentRound;
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        marginBottom: 8,
        fontSize: 12,
        background: C.panel,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "transparent",
            border: "none",
            color: C.text,
            font: "inherit",
            textAlign: "left",
            padding: "10px 4px 10px 12px",
            cursor: "pointer",
            lineHeight: 1.5,
          }}
        >
          <span aria-hidden="true" style={{ color: C.dim }}>
            {isOpen ? "▾" : "▸"}
          </span>
          <span>
            <span style={{ color: C.dim }}>
              Round {review.round}
              {/* A review taken at round 5 still reads as covering rounds 1–5
                  once the process has moved on; saying so is what stops it
                  looking like a description of where things stand now. */}
              {stale && ` of ${currentRound}`} ·{" "}
            </span>
            {review.headline}
          </span>
        </button>
        <Tooltip text="Discard this review">
          <button
            onClick={onDiscard}
            style={{
              width: 26,
              height: 26,
              margin: "9px 8px 0 0",
              borderRadius: "50%",
              background: "transparent",
              border: `1.5px solid ${C.border}`,
              color: C.dim,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <TrashIcon size="11px" />
          </button>
        </Tooltip>
      </div>
      {isOpen && (
        <div style={{ padding: "0 14px 12px" }}>
          {review.origin && (
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
              AI-generated by {review.origin}
            </div>
          )}
          <ReviewBody review={review} />
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Function} props.onSaveReview
 * @param {Function} props.onDiscardReview
 */
export function ProcessReviewTab({
  state,
  onSaveReview,
  onDiscardReview,
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
  } = useSuggestionWorkflow(fetchProcessReview);

  const saved = reviewsOf(state);
  const candidate = suggestions?.[0] ?? null;
  const draft = editing?.suggestion === candidate ? editing.draft : null;

  /**
   * Which saved reviews are open. Held as the set of entries whose state is
   * *flipped* from the default rather than the set of open ones, so that "the
   * newest is open" survives a new review being accepted — which changes which
   * entry is newest, and is exactly the moment the user wants it open.
   */
  const [flipped, setFlipped] = useState(() => new Set());
  const isOpen = (review, i) =>
    (i === saved.length - 1) !== flipped.has(review.id);
  const toggle = (id) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const analyse = () => run(state, useDummy);

  const accept = () => {
    const merged = { ...candidate, ...draft };
    const wasEdited = FIELDS.some((key) => merged[key] !== candidate[key]);
    onSaveReview({
      ...Object.fromEntries(FIELDS.map((key) => [key, merged[key] ?? ""])),
      model: model ?? "",
      origin: llmOrigin(wasEdited, model),
    });
    setEditing(null);
    setSuggestions([]);
  };

  // Nothing is recorded on rejection. A rejected element is kept so the prompt
  // can avoid re-offering it, but a review is written fresh from the state each
  // time — there is no pool for it to be drawn from again.
  const reject = () => {
    setEditing(null);
    setSuggestions([]);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <SuggestionToolbar
          tab="processReview"
          title="Review Process"
          actionLabel="Analyse"
          rerunLabel="Analyse again"
          suggestionCount={null}
          loading={loading}
          hasResult={hasResult}
          onRun={analyse}
          model={model}
          disabled={suggestionsDisabled}
          needs={
            state.log.length < 2
              ? "Work through at least two rounds first."
              : undefined
          }
          disclosure={
            candidate && (
              <AiDisclosureBanner
                model={model}
                note="Review carefully before accepting it into your process."
              />
            )
          }
        />
        {error && <ErrorBanner message={error} />}

        {state.log.length < 2 && (
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
            A review reports how your position moved across the rounds, so there
            has to be a process to read. Work through a couple of rounds first.
          </div>
        )}

        {candidate && (
          <>
            <CandidateCard
              review={candidate}
              draft={draft}
              onAccept={accept}
              onReject={reject}
              onModify={() =>
                setEditing({
                  suggestion: candidate,
                  draft: Object.fromEntries(
                    FIELDS.map((key) => [key, candidate[key] ?? ""]),
                  ),
                })
              }
              onDraftChange={(key, text) =>
                setEditing((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, [key]: text },
                }))
              }
              onModifyCancel={() => setEditing(null)}
            />
          </>
        )}

        {hasResult && !candidate && saved.length === 0 && (
          <div style={{ fontSize: 12, color: C.dim }}>No review saved.</div>
        )}

        {saved.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                margin: "18px 0 8px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Saved reviews · {saved.length}
            </div>
            {/* Newest first to read, but the underlying series stays oldest-first
                so each review's back-references point at entries below it. */}
            {saved
              .map((review, i) => ({ review, i }))
              .reverse()
              .map(({ review, i }) => (
                <SavedReview
                  key={review.id}
                  review={review}
                  currentRound={state.round}
                  isOpen={isOpen(review, i)}
                  onToggle={() => toggle(review.id)}
                  onDiscard={() => onDiscardReview(review.id)}
                />
              ))}
          </>
        )}

        {!hasResult &&
          !loading &&
          saved.length === 0 &&
          state.log.length >= 2 && (
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
              Ask for a reading of the process so far: where the centre of your
              position moved, where it turned unexpectedly, and where an
              increase in coherence would have been available.
              {suggestionsAreSample && " A pre-set example is shown here."}
            </div>
          )}
      </div>
    </div>
  );
}
