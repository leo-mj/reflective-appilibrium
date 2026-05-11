/**
 * @fileoverview Simulate tab — runs the rethon RE simulation and visualises
 * the equilibrium result, detected arguments, and evolution.
 * @module components/SimulateRethonTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useMemo } from "react";
import { C } from "../../constants/colors.js";
import { SpinnerIcon } from "../Icons.jsx";
import { simulateRethon } from "../../utils/simulateRethonClient.js";
import { ErrorBanner } from "../SuggestionActions.jsx";

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

function IdBadge({ element, negated = false }) {
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
        textDecoration: negated ? "line-through" : "none",
      }}
    >
      {element.id}
    </span>
  );
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
        {premises.map((p) => p.text).join(" + ")}
        <span style={{ color: C.dim }}> → </span>
        {conclusion.text}
      </div>
    </div>
  );
}

function EvolutionStep({ step, position }) {
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
      <span
        style={{
          color: C.dim,
          minWidth: 24,
          textAlign: "right",
          paddingTop: 2,
        }}
      >
        {step}
      </span>
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
 */
export function SimulateRethonTab({
  state,
  useDummy = false,
  onApplyRethonEquilibrium,
}) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [evolutionOpen, setEvolutionOpen] = useState(false);

  const activeCount = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.status !== "rejected",
  ).length;

  const atLeastOneArgument =
    state.relations.filter((r) => r.type === "jointly_entails").length > 0;

  const equilibrium = useMemo(
    () => (result ? deriveEquilibrium(result) : null),
    [result],
  );

  const simulate = async () => {
    setLoading(true);
    setError(null);
    setEvolutionOpen(false);
    try {
      const data = await simulateRethon(state, useDummy);
      setResult(data);
      const evolution = data.translated_re_state.evolution;
      const lastTwo = evolution.slice(-2);
      const equilibriumIds = new Set(
        lastTwo.flatMap((pos) =>
          pos.filter((e) => !e.negated).map((e) => e.id),
        ),
      );
      onApplyRethonEquilibrium?.(equilibriumIds);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || activeCount < 3 || atLeastOneArgument > 0;

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
            {equilibrium && (
              <span
                style={{
                  color: equilibrium.finished ? C.supports : C.conflicts,
                }}
              >
                {" · "}
                {equilibrium.finished ? `converged` : `did not converge`}
                {` in ${equilibrium.steps} step${equilibrium.steps !== 1 ? "s" : ""}`}
              </span>
            )}
            {result?.model && (
              <span style={{ color: C.dim }}>
                {" · "}
                {result.model}
              </span>
            )}
          </div>
          <button
            onClick={simulate}
            disabled={disabled}
            style={{
              background: "transparent",
              border: `1px solid ${disabled ? C.border : ACCENT}`,
              color: disabled ? C.dim : ACCENT,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: "bold",
              cursor: disabled ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
            }}
          >
            {loading ? <SpinnerIcon /> : <span>↺</span>}
            {loading ? "Simulating…" : result ? "Re-simulate" : "Simulate"}
          </button>
        </div>

        {(activeCount || atLeastOneArgument > 0) < 3 && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least three active elements and one argument to run the
            simulation.
          </div>
        )}

        {error && <ErrorBanner message={error} />}

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
                <EvolutionStep key={i} step={i} position={pos} />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
