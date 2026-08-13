import { useState, useEffect } from "react";
import {
  WORKFLOW_NEXT_PHASE,
  WORKFLOW_PHASE_LABELS,
} from "../../utils/workflowUtils.js";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { SpinnerIcon } from "../Icons.jsx";
import { quickScore } from "../../utils/simulateRethonClient.js";
import { sendsToLlmText } from "../../utils/openaiClient.js";
import { suggestionsUnavailable } from "../../utils/disabledReason.js";

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
 * @param {string}           props.accent      Colour for the title and button.
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
 */
export function SuggestionToolbar({
  accent,
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
  advanceWorkflow,
  nextPhaseIsEnabled,
}) {
  const isDisabled = loading || disabled || Boolean(needs);
  const why = suggestionsUnavailable({ loading, noBackend: disabled, needs });
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
        <span style={{ color: accent, fontWeight: "bold" }}>{title}</span>
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
            style={{
              background: "transparent",
              border: `1px solid ${isDisabled ? C.border : accent}`,
              color: isDisabled ? C.dim : accent,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: "bold",
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
              advanceWorkflow={advanceWorkflow}
            />
          </>
        )}
      </div>
    </div>
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

export function ProgressWorkflowBtn({
  nextPhaseIsEnabled,
  workflowPhase,
  advanceWorkflow,
  hideNonEntailsRels = true,
}) {
  if (!workflowPhase) return null;
  let label = WORKFLOW_PHASE_LABELS[WORKFLOW_NEXT_PHASE[workflowPhase]];
  if (workflowPhase === "detectArguments" && hideNonEntailsRels) {
    label = "Workflow Step: Elicit Judgments";
  }
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
