import { useState, useEffect } from "react";
import { WORKFLOW_PHASE_LABELS } from "../../utils/workflowUtils.js";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { SpinnerIcon } from "../Icons.jsx";
import { quickScore } from "../../utils/simulateRethonClient.js";
import { sendsToLlmText } from "../../utils/openaiClient.js";
import { suggestionsUnavailable } from "../../utils/disabledReason.js";
import { useHeaderAccent } from "../../hooks/useHeaderAccent.js";

/**
 * The ground the header strip is drawn on, pinned to the top of the tab's own
 * scroller: the next-phase button is how the workflow is advanced, and a long
 * list of suggestions must not scroll it out of reach.
 *
 * The AI disclosure rides along rather than scrolling with the cards, since what
 * it discloses is exactly what is on screen — a notice that has scrolled away is
 * a notice the reader accepting a suggestion no longer has.
 *
 * Three things about the box are load-bearing. The negative margin puts the
 * opaque ground out to the scroller's own 4px padding, or cards slide past it
 * down either edge. `flow-root` keeps the disclosure's bottom margin *inside*
 * the strip — collapsed through it, the ground would end at the banner's border
 * and a card would show in the gap below. And with no disclosure the row's own
 * 14px is all that is left, which is the spacing the header had before it was
 * pinned.
 *
 * @param {Object}    props
 * @param {ReactNode} [props.disclosure] The tab's `<AiDisclosureBanner>`, when
 *   it is showing live model output.
 * @param {ReactNode} props.children     The header row's contents.
 */
export function ToolbarStrip({ disclosure, children }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        background: C.bg,
        margin: "0 -4px",
        padding: "10px 4px 0",
        display: "flow-root",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {children}
      </div>
      {disclosure}
    </div>
  );
}

/**
 * The header strip shared by the three suggestion tabs: a title with a running
 * count and the model name, the button that asks the LLM for more, and the
 * workflow's next-phase control.
 *
 * The three tabs previously carried a copy of this each. They differed only in
 * accent colour, wording, and the extra condition under which the button is
 * disabled — so those are the props, and everything else is here once.
 *
 * @param {Object}           props
 * @param {string}           props.tab         The tab's key from `ASSIST_TABS`,
 *   which is what its colour is derived from — see {@link useHeaderAccent}. A
 *   key rather than a colour so that one place decides what a tab wears, and so
 *   the high-contrast badge cannot be applied to some headers and not others.
 * @param {string}           props.title       e.g. "Suggest Principles".
 * @param {string}           props.actionLabel Button text before the first result.
 * @param {string}           props.rerunLabel  Button text once there is a result.
 * @param {number|null}      props.suggestionCount Remaining, or null before fetching.
 * @param {boolean}          props.loading
 * @param {boolean}          props.hasResult
 * @param {Function}         props.onRun
 * @param {string|undefined} props.model
 * @param {boolean}          [props.disabled]  No backend, so nothing can be asked.
 * @param {string}           [props.needs]     What the process still lacks, if
 *   anything, e.g. "Add at least two elements first." Also disables the button.
 * @param {ReactNode}        [props.disclosure] The AI notice, pinned with the
 *   header rather than scrolling — see {@link ToolbarStrip}.
 */
export function SuggestionToolbar({
  tab,
  title,
  actionLabel,
  rerunLabel,
  suggestionCount,
  loading,
  hasResult,
  onRun,
  model,
  disabled = false,
  needs,
  workflowPhase,
  nextPhase,
  advanceWorkflow,
  nextPhaseIsEnabled,
  disclosure,
}) {
  const isDisabled = loading || disabled || Boolean(needs);
  const why = suggestionsUnavailable({ loading, noBackend: disabled, needs });
  const { accent, ink, weight, marker, badge } = useHeaderAccent(tab);
  return (
    <ToolbarStrip disclosure={disclosure}>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <span {...marker} style={{ ...badge, color: ink, fontWeight: weight }}>
          {title}
        </span>
        {suggestionCount !== null && (
          <span style={{ color: C.dim }}> · {suggestionCount} remaining</span>
        )}
        {model && <span style={{ color: C.dim }}> · {model}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <Tooltip text={sendsToLlmText()}>
          <button
            onClick={onRun}
            disabled={isDisabled}
            title={why}
            {...(isDisabled ? {} : marker)}
            style={{
              background: "transparent",
              // The badge goes on the button too: it carries the same colour, so
              // whatever makes the title legible has to make this legible.
              ...(isDisabled ? {} : badge),
              border: `1px solid ${isDisabled ? C.border : accent}`,
              color: isDisabled ? C.dim : ink,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: isDisabled ? "bold" : weight,
              cursor: isDisabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {loading ? <SpinnerIcon /> : <span>↺</span>}
            {loading ? "Thinking…" : hasResult ? rerunLabel : actionLabel}
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
              nextPhase={nextPhase}
              advanceWorkflow={advanceWorkflow}
            />
          </>
        )}
      </div>
    </ToolbarStrip>
  );
}

/**
 * Shows account (A) and systematicity (S) deltas for accepting one suggestion.
 * Calls `quick_score` with a temporary element appended and subtracts the
 * pre-computed baseline.  Renders nothing while loading or when scoring is
 * unavailable.
 */
export function ScoreDeltaBadge({
  state,
  text,
  type,
  confidence,
  baseline,
  weights,
}) {
  const [delta, setDelta] = useState(null);

  useEffect(() => {
    if (baseline == null) return;
    let cancelled = false;
    const prefix = type === "principle" ? "P" : "J";
    const maxNum = Math.max(
      0,
      ...state.elements
        .map((e) => parseInt(e.id.slice(1)))
        .filter((n) => !isNaN(n)),
    );
    const tempElement = {
      id: `${prefix}${maxNum + 1}`,
      type,
      status: "active",
      confidence: confidence ?? 0.67,
      origin: "llm",
      text,
      addedRound: state.round,
    };
    quickScore([...state.elements, tempElement], state.relations, weights).then(
      (scores) => {
        if (!cancelled && scores != null) {
          setDelta({
            account: scores.account - baseline.account,
            systematicity: scores.systematicity - baseline.systematicity,
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [text, baseline, weights]); // eslint-disable-line react-hooks/exhaustive-deps

  if (delta == null) return null;

  const fmtDelta = (v) => `${v > 0 ? "+" : ""}${v.toFixed(3)}`;
  const color = (v) =>
    v > 0.001 ? C.supports : v < -0.001 ? C.conflicts : C.dim;
  return (
    <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: "bold",
          color: color(delta.account),
        }}
      >
        A {fmtDelta(delta.account)}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: "bold",
          color: color(delta.systematicity),
        }}
      >
        S {fmtDelta(delta.systematicity)}
      </span>
    </span>
  );
}

const workflowBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "5px 12px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: "bold",
  background: "transparent",
  color: C.dim,
};

/**
 * The control that moves the workflow on, labelled with where it goes.
 *
 * `nextPhase` is handed in rather than worked out here. It is `REState` that
 * routes — and the routing now turns on the hidden-relations setting *and* the
 * iteration count, neither of which is this button's business — so recomputing
 * it here is how the label comes to name a phase the press does not go to. It
 * had drifted that way once already: the button read the skip past the relations
 * phase off a `hideNonEntailsRels` default of `true` that its own caller never
 * passed.
 */
export function ProgressWorkflowBtn({
  nextPhaseIsEnabled,
  workflowPhase,
  nextPhase,
  advanceWorkflow,
}) {
  if (!workflowPhase) return null;
  const label = WORKFLOW_PHASE_LABELS[nextPhase];
  const tooltipText =
    !nextPhaseIsEnabled && workflowPhase === "elicitJudgments"
      ? "Add at least 3 judgments to continue"
      : null;
  return (
    <Tooltip text={tooltipText}>
      <span style={{ display: "inline-flex" }}>
        <button
          onClick={advanceWorkflow}
          disabled={!nextPhaseIsEnabled}
          style={{
            ...workflowBtnStyle,
            color: nextPhaseIsEnabled ? C.supports : C.dim,
            borderColor: nextPhaseIsEnabled ? C.supports : C.border,
            cursor: nextPhaseIsEnabled ? "pointer" : "not-allowed",
          }}
        >
          {label} →
        </button>
      </span>
    </Tooltip>
  );
}
