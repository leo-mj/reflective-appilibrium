/**
 * @fileoverview Simulate tab — runs the rethon RE simulation and visualises
 * the equilibrium result, detected arguments, and evolution.
 * @module components/SimulateRethonTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useMemo, useEffect } from "react";
import { C } from "../../constants/colors.js";
import { SpinnerIcon } from "../Icons.jsx";
import {
  simulateRethon,
  simulateRethonStep,
} from "../../utils/simulateRethonClient.js";
import { ErrorBanner } from "../SuggestionActions.jsx";
import { ARGUMENT_RELATION_TYPES } from "../../utils/stateUtils.js";
import {
  SectionHead,
  ElementRow,
  ArgumentCard,
  ScoreRow,
  EvolutionStep,
} from "./SimulateRethonCards.jsx";
import { SimulateScoresChart } from "../graphs_shared/SimulateScoresChart.jsx";

const ACCENT = C.principle.accent;
/** The same accent where it is type rather than a shape — see index.css. */
const ACCENT_TEXT = C.principle.text;

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Function} [props.onApplyRethonEquilibrium]
 * @param {Function} [props.onSetEquilibriumPreview]
 */
export function SimulateRethonTab({
  state,
  onApplyRethonEquilibrium,
  onSetEquilibriumPreview,
  weights = null,
}) {
  const [result, setResult] = useState(null);
  const [resultMode, setResultMode] = useState(null); // "simulate" | "step" | null
  const [confirmedEvolution, setConfirmedEvolution] = useState(null);
  const [confirmedResult, setConfirmedResult] = useState(null);
  const [stepPending, setStepPending] = useState(false);
  const [loadingMode, setLoadingMode] = useState(null); // "simulate" | "step" | null
  const [error, setError] = useState(null);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [decision, setDecision] = useState(null); // "accepted" | "rejected" | null
  const [neighbourhoodDepth, setNeighbourhoodDepth] = useState(1);

  useEffect(() => () => onSetEquilibriumPreview?.(null), [onSetEquilibriumPreview]);

  const activeCount = state.elements.filter((e) =>
    ["active", "revised"].includes(e.status),
  ).length;

  const atLeastOneArgument =
    state.relations.filter((r) => ARGUMENT_RELATION_TYPES.has(r.type)).length > 0;

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
      const data = await simulateRethon(state, true, startingEvolution, weights, neighbourhoodDepth);
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
      const data = await simulateRethonStep(state, true, confirmedEvolution, weights, neighbourhoodDepth);
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
  const baseDisabled = loadingMode !== null || activeCount < 3 || !atLeastOneArgument;

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
            <span style={{ color: ACCENT_TEXT, fontWeight: "bold" }}>Simulate RE</span>
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
              <span style={{ color: equilibrium.finished ? C.supports : C.conflicts }}>
                {" · "}
                {equilibrium.finished ? "Equilibrium reached" : "Equilibrium not reached yet"}
              </span>
            )}
            {result?.model && (
              <span style={{ color: C.dim }}>{" · "}{result.model}</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 11, color: C.dim, display: "flex", alignItems: "center", gap: 4 }}>
              Depth
              <select
                value={neighbourhoodDepth}
                onChange={(e) => setNeighbourhoodDepth(Number(e.target.value))}
                disabled={loadingMode !== null}
                style={{ fontSize: 11, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "2px 4px" }}
              >
                {[1, 2, 3, 4].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            {/* Simulate button */}
            <button
              onClick={simulate}
              disabled={baseDisabled}
              style={{
                background: "transparent",
                border: `1px solid ${baseDisabled ? C.border : ACCENT}`,
                color: baseDisabled ? C.dim : ACCENT_TEXT,
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

            <div style={{ width: 1, height: 24, background: C.border, margin: "0 4px", alignSelf: "center" }} />

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
                    color: stepDisabled ? C.dim : ACCENT_TEXT,
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

        {(activeCount < 3 || !atLeastOneArgument) && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least three active elements and one argument to run the simulation.
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {/* Accept / Reject */}
        {equilibrium &&
          (decision === "accepted" ? (
            <div style={{ fontSize: 12, color: C.supports, marginTop: 12 }}>✓ Applied to state</div>
          ) : decision === "rejected" ? (
            <div style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>Result discarded</div>
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
            <SectionHead title="Equilibrium" />
            {(() => {
              const scores = result?.translated_re_state.scores;
              const lastScore = scores?.findLast((s) => s != null) ?? null;
              return lastScore ? (
                <div style={{ marginBottom: 10 }}>
                  <ScoreRow scores={lastScore} highlight />
                </div>
              ) : null;
            })()}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.supports, fontWeight: "bold", marginBottom: 6 }}>
                  Retained · {equilibrium.retained.length}
                </div>
                {equilibrium.retained.map((e) => <ElementRow key={e.id} element={e} />)}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.dim, fontWeight: "bold", marginBottom: 6 }}>
                  Withdrawn · {equilibrium.withdrawn.length}
                </div>
                {equilibrium.withdrawn.map((e) => <ElementRow key={e.id} element={e} faded />)}
              </div>
            </div>
          </>
        )}

        {result && (
          <>
            <SectionHead title="Arguments" count={result.translated_arguments.length} />
            {result.translated_arguments.length === 0 ? (
              <div style={{ fontSize: 12, color: C.dim }}>No arguments detected.</div>
            ) : (
              result.translated_arguments.map((arg, i) => (
                <ArgumentCard key={i} argument={arg} />
              ))
            )}

            <SectionHead title="Evolution" count={result.translated_re_state.evolution.length} />
            <SimulateScoresChart scores={result.translated_re_state.scores ?? []} />
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
                  scores={result.translated_re_state.scores?.[i] ?? null}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
