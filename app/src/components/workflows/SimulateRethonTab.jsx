/**
 * @fileoverview Simulate tab — runs the rethon RE simulation and visualises
 * the equilibrium result, detected arguments, and evolution.
 * @module components/SimulateRethonTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useMemo } from "react";
import { C } from "../../constants/colors.js";
import { SpinnerIcon } from "../Icons.jsx";
import {
  simulateRethon,
  simulateRethonStep,
} from "../../utils/simulateRethonClient.js";
import { ErrorBanner } from "../SuggestionActions.jsx";
import { WeightTriangle } from "./WeightTriangle.jsx";

const ACCENT = C.principle.high;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elementColor(type) {
  return type === "judgment"
    ? C.judgment.high
    : type === "principle"
      ? C.principle.high
      : C.theory.high;
}

function deriveEquilibrium(result) {
  const evolution = result.translated_re_state.evolution;
  const lastTwo = evolution.slice(-2);
  const seenIds = new Set();
  const retained = [];
  for (const pos of lastTwo) {
    for (const e of pos) {
      if (!e.negated && !seenIds.has(e.id)) {
        seenIds.add(e.id);
        retained.push(e);
      }
    }
  }
  const initial = (evolution[0] ?? []).filter((e) => !e.negated);
  const withdrawn = initial.filter((e) => !seenIds.has(e.id));
  return {
    retained,
    withdrawn,
    finished: result.translated_re_state.finished,
    steps: evolution.length,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({ title, count }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: "bold",
        color: C.dim,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        margin: "16px 0 8px",
      }}
    >
      {title}
      {count != null && (
        <span style={{ fontWeight: "normal" }}> · {count}</span>
      )}
    </div>
  );
}

function ElementRow({ element, faded = false }) {
  const color = elementColor(element.type);
  return (
    <div
      style={{
        borderLeft: `3px solid ${faded ? C.border : color}`,
        padding: "6px 10px",
        marginBottom: 6,
        background: C.panel,
        borderRadius: "0 4px 4px 0",
        opacity: faded ? 0.5 : 1,
      }}
    >
      <span
        style={{
          color: faded ? C.dim : color,
          fontWeight: "bold",
          fontSize: 11,
          marginRight: 6,
        }}
      >
        {element.id}
      </span>
      <span style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>
        {element.text}
      </span>
    </div>
  );
}

function IdBadge({ element }) {
  const negated = element.negated;
  const color = elementColor(element.type);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: "bold",
        color: negated ? C.dim : color,
        border: `1px solid ${negated ? C.border : color}`,
        borderRadius: 4,
        padding: "1px 5px",
      }}
    >
      {negated ? "¬" : ""}
      {element.id}
    </span>
  );
}

function elementLabel(element) {
  return element.negated ? `not ${element.text}` : element.text;
}

function ArgumentCard({ argument }) {
  const conclusion = argument.at(-1);
  const premises = argument.slice(0, -1);
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "7px 10px",
        marginBottom: 6,
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        {premises.map((p, i) => (
          <span
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <IdBadge element={p} />
            {i < premises.length - 1 && <span style={{ color: C.dim }}>+</span>}
          </span>
        ))}
        <span style={{ color: C.dim }}>→</span>
        <IdBadge element={conclusion} />
      </div>
      <div style={{ color: C.dim, lineHeight: 1.5 }}>
        {premises.map((p) => elementLabel(p)).join(" + ")}
        <span style={{ color: C.dim }}> → </span>
        {elementLabel(conclusion)}
      </div>
    </div>
  );
}

function EvolutionStep({ step, stepType, position }) {
  const isCommitments = stepType === "commitments";
  const typeColor = isCommitments ? C.judgment.high : C.principle.high;
  const typeLabel = isCommitments ? "C" : "T";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 6,
        fontSize: 11,
      }}
    >
      {/* Step index */}
      <span
        style={{
          color: C.dim,
          minWidth: 16,
          textAlign: "right",
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        {step}
      </span>
      {/* Commitments / Theory label */}
      <span
        title={isCommitments ? "Commitments position" : "Theory position"}
        style={{
          color: typeColor,
          border: `1px solid ${typeColor}`,
          borderRadius: 3,
          padding: "0 4px",
          fontSize: 10,
          fontWeight: "bold",
          lineHeight: "17px",
          flexShrink: 0,
          opacity: 0.75,
        }}
      >
        {typeLabel}
      </span>
      {/* Element badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {position.length === 0 ? (
          <span style={{ color: C.dim }}>∅</span>
        ) : (
          position.map((e, i) => (
            <IdBadge key={i} element={e} negated={e.negated} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {boolean}  [props.useDummy]
 * @param {Function} [props.onApplyRethonEquilibrium]
 * @param {Function} [props.onSetEquilibriumPreview]
 */
export function SimulateRethonTab({
  state,
  useDummy = false,
  onApplyRethonEquilibrium,
  onSetEquilibriumPreview,
}) {
  const DEFAULT_WEIGHTS = {
    account: 0.35,
    systematicity: 0.55,
    faithfulness: 0.1,
  };

  const [result, setResult] = useState(null);
  const [resultMode, setResultMode] = useState(null); // "simulate" | "step" | null
  // Step-mode tracking: confirmed = accepted evolution; pending = awaiting accept/reject
  const [confirmedEvolution, setConfirmedEvolution] = useState(null);
  const [confirmedResult, setConfirmedResult] = useState(null);
  const [stepPending, setStepPending] = useState(false);
  const [loadingMode, setLoadingMode] = useState(null); // "simulate" | "step" | null
  const [error, setError] = useState(null);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [decision, setDecision] = useState(null); // "accepted" | "rejected" | null
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  const weightsChanged =
    weights.account !== DEFAULT_WEIGHTS.account ||
    weights.systematicity !== DEFAULT_WEIGHTS.systematicity ||
    weights.faithfulness !== DEFAULT_WEIGHTS.faithfulness;

  function resetWeights() {
    setWeights(DEFAULT_WEIGHTS);
  }

  const effectiveWeights = weightsChanged ? weights : null;

  const activeCount = state.elements.filter((e) =>
    ["active", "revised"].includes(e.status),
  ).length;

  const atLeastOneArgument =
    state.relations.filter(
      (r) => r.type === "jointly_entails" || r.type === "jointly_precludes",
    ).length > 0;

  const equilibrium = useMemo(
    () => (result ? deriveEquilibrium(result) : null),
    [result],
  );

  const simulate = async () => {
    const startingEvolution = confirmedEvolution;
    setLoadingMode("simulate");
    setError(null);
    setEvolutionOpen(false);
    setDecision(null);
    setConfirmedEvolution(null);
    setConfirmedResult(null);
    setStepPending(false);
    onSetEquilibriumPreview?.(null);
    try {
      const data = await simulateRethon(
        state,
        true,
        startingEvolution,
        useDummy,
        effectiveWeights,
      );
      setResult(data);
      setResultMode("simulate");
      const eq = deriveEquilibrium(data);
      onSetEquilibriumPreview?.(new Set(eq.withdrawn.map((e) => e.id)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMode(null);
    }
  };

  const step = async () => {
    setLoadingMode("step");
    setError(null);
    if (confirmedEvolution === null) {
      setEvolutionOpen(false);
      setDecision(null);
      setConfirmedResult(null);
      onSetEquilibriumPreview?.(null);
    }
    try {
      const data = await simulateRethonStep(
        state,
        true,
        confirmedEvolution,
        effectiveWeights,
      );
      setResult(data);
      setResultMode("step");
      setStepPending(true);
      const eq = deriveEquilibrium(data);
      onSetEquilibriumPreview?.(new Set(eq.withdrawn.map((e) => e.id)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMode(null);
    }
  };

  const handleAccept = () => {
    const evolution = result.translated_re_state.evolution;
    const lastTwo = evolution.slice(-2);
    const equilibriumIds = new Set(
      lastTwo.flatMap((pos) => pos.filter((e) => !e.negated).map((e) => e.id)),
    );
    if (resultMode === "step") {
      setConfirmedEvolution(evolution);
      setConfirmedResult(result);
      setStepPending(false);
      if (result.translated_re_state.finished) {
        onApplyRethonEquilibrium?.(equilibriumIds);
        onSetEquilibriumPreview?.(null);
        setDecision("accepted");
      }
    } else {
      onApplyRethonEquilibrium?.(equilibriumIds);
      onSetEquilibriumPreview?.(null);
      setDecision("accepted");
    }
  };

  const handleReject = () => {
    if (resultMode === "step") {
      setResult(confirmedResult);
      setStepPending(false);
      if (confirmedResult) {
        const eq = deriveEquilibrium(confirmedResult);
        onSetEquilibriumPreview?.(new Set(eq.withdrawn.map((e) => e.id)));
      } else {
        onSetEquilibriumPreview?.(null);
      }
    } else {
      onSetEquilibriumPreview?.(null);
      setDecision("rejected");
    }
  };

  const stepFinished = confirmedResult?.translated_re_state.finished ?? false;
  const baseDisabled =
    loadingMode !== null ||
    activeCount < 3 ||
    !atLeastOneArgument;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        {/* Toolbar */}
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
            <span style={{ color: ACCENT, fontWeight: "bold" }}>
              Simulate RE
            </span>
            <span style={{ color: C.dim }}>
              {" · "}
              {activeCount} active element{activeCount !== 1 ? "s" : ""}
            </span>
            {confirmedEvolution !== null && !stepFinished && (
              <span style={{ color: C.dim }}>
                {" · "}
                {confirmedEvolution.length - 1} step
                {confirmedEvolution.length - 1 !== 1 ? "s" : ""}
              </span>
            )}
            {equilibrium && (
              <span
                style={{
                  color: equilibrium.finished ? C.supports : C.conflicts,
                }}
              >
                {" · "}
                {equilibrium.finished
                  ? "Equilibrium reached"
                  : "Equilibrium not reached yet"}
              </span>
            )}
            {result?.model && (
              <span style={{ color: C.dim }}>
                {" · "}
                {result.model}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            {/* Simulate button */}
            <button
              onClick={simulate}
              disabled={baseDisabled}
              style={{
                background: "transparent",
                border: `1px solid ${baseDisabled ? C.border : ACCENT}`,
                color: baseDisabled ? C.dim : ACCENT,
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: "bold",
                cursor: baseDisabled ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 2,
                flexShrink: 0,
              }}
            >
              {loadingMode === "simulate" ? <SpinnerIcon /> : <span>↺</span>}
              {loadingMode === "simulate" ? "Equilibrating..." : "Equilibrate"}
            </button>

            {/* Divider */}
            <div
              style={{
                width: 1,
                height: 24,
                background: C.border,
                margin: "0 4px",
                alignSelf: "center",
              }}
            />

            {/* Step button */}
            {(() => {
              const stepDisabled = baseDisabled || stepPending || stepFinished;
              const stepLabel =
                loadingMode === "step"
                  ? "Stepping…"
                  : confirmedEvolution !== null
                    ? "Next Step"
                    : "Step";
              return (
                <button
                  onClick={step}
                  disabled={stepDisabled}
                  title={
                    stepFinished
                      ? "The RE process has reached a fixed point"
                      : stepPending
                        ? "Accept or reject this step first"
                        : undefined
                  }
                  style={{
                    background: "transparent",
                    border: `1px solid ${stepDisabled ? C.border : ACCENT}`,
                    color: stepDisabled ? C.dim : ACCENT,
                    borderRadius: 6,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: "bold",
                    cursor: stepDisabled ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  {loadingMode === "step" ? <SpinnerIcon /> : <span>→</span>}
                  {stepLabel}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Weights panel */}
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setWeightsOpen((o) => !o)}
            style={{
              background: "transparent",
              border: `1px solid ${weightsChanged ? ACCENT : C.border}`,
              color: weightsChanged ? ACCENT : C.dim,
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Weights{weightsChanged ? " *" : ""}
          </button>
          {weightsOpen && (
            <div style={{ marginTop: 8 }}>
              <WeightTriangle
                weights={weights}
                onChange={setWeights}
                weightsChanged={weightsChanged}
              />
              {weightsChanged && (
                <button
                  onClick={resetWeights}
                  style={{
                    marginTop: 6,
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    color: C.dim,
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {(activeCount < 3 || !atLeastOneArgument) && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least three active elements and one argument to run the
            simulation.
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {/* Accept / Reject */}
        {equilibrium &&
          (decision === "accepted" ? (
            <div style={{ fontSize: 12, color: C.supports, marginTop: 12 }}>
              ✓ Applied to state
            </div>
          ) : decision === "rejected" ? (
            <div style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>
              Result discarded
            </div>
          ) : stepPending || resultMode === "simulate" ? (
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button
                onClick={handleAccept}
                style={{
                  background: C.supports + "18",
                  border: `1px solid ${C.supports}`,
                  color: C.supports,
                  borderRadius: 6,
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Accept
              </button>
              <button
                onClick={handleReject}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  color: C.dim,
                  borderRadius: 6,
                  padding: "5px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Reject
              </button>
            </div>
          ) : null)}

        {equilibrium && (
          <>
            {/* Equilibrium result */}
            <SectionHead title="Equilibrium" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: C.supports,
                    fontWeight: "bold",
                    marginBottom: 6,
                  }}
                >
                  Retained · {equilibrium.retained.length}
                </div>
                {equilibrium.retained.map((e) => (
                  <ElementRow key={e.id} element={e} />
                ))}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: C.dim,
                    fontWeight: "bold",
                    marginBottom: 6,
                  }}
                >
                  Withdrawn · {equilibrium.withdrawn.length}
                </div>
                {equilibrium.withdrawn.map((e) => (
                  <ElementRow key={e.id} element={e} faded />
                ))}
              </div>
            </div>
          </>
        )}

        {result && (
          <>
            {/* Arguments */}
            <SectionHead
              title="Arguments"
              count={result.translated_arguments.length}
            />
            {result.translated_arguments.length === 0 ? (
              <div style={{ fontSize: 12, color: C.dim }}>
                No arguments detected.
              </div>
            ) : (
              result.translated_arguments.map((arg, i) => (
                <ArgumentCard key={i} argument={arg} />
              ))
            )}

            {/* Evolution (collapsible) */}
            <SectionHead
              title="Evolution"
              count={result.translated_re_state.evolution.length}
            />
            <button
              onClick={() => setEvolutionOpen((o) => !o)}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                color: C.dim,
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                cursor: "pointer",
                marginBottom: evolutionOpen ? 10 : 0,
              }}
            >
              {evolutionOpen ? "Hide" : "Show"} steps
            </button>
            {evolutionOpen &&
              result.translated_re_state.evolution.map((pos, i) => (
                <EvolutionStep
                  key={i}
                  step={i}
                  stepType={result.translated_re_state.step_types?.[i]}
                  position={pos}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
