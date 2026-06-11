/**
 * @fileoverview Simulate tab — runs the rethon RE simulation and visualises
 * the equilibrium result, detected arguments, and evolution.
 * @module components/SimulateRethonTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useMemo, useRef, useEffect } from "react";
import { scaleLinear, line as d3Line, curveMonotoneX } from "d3";
import { C } from "../../constants/colors.js";
import { SpinnerIcon } from "../Icons.jsx";
import {
  simulateRethon,
  simulateRethonStep,
} from "../../utils/simulateRethonClient.js";
import { ErrorBanner } from "../SuggestionActions.jsx";
import { ARGUMENT_RELATION_TYPES } from "../../utils/stateUtils.js";

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

/**
 * Display Z + the relevant component scores in a compact inline row.
 *
 * When `stepType` is provided only the scores that actually changed at that
 * step are shown:
 *   - theory step     → Z, Account, Systematicity  (faithfulness didn't change)
 *   - commitments step → Z, Account, Faithfulness  (systematicity didn't change)
 *   - null (summary)  → all four
 */
function ScoreRow({ scores, highlight = false, stepType = null }) {
  if (!scores) return null;
  const fmt = (v) => v.toFixed(3);
  const allEntries = [
    {
      key: "z",
      label: "Z-Score",
      value: scores.z,
      color: highlight ? ACCENT : C.dim,
    },
    {
      key: "account",
      label: "Account",
      value: scores.account,
      color: C.judgment.high,
    },
    {
      key: "systematicity",
      label: "Systematicity",
      value: scores.systematicity,
      color: C.principle.high,
    },
    {
      key: "faithfulness",
      label: "Faithfulness",
      value: scores.faithfulness,
      color: C.theory.high,
    },
  ];
  const entries = allEntries.filter(({ key }) => {
    if (!stepType) return true;
    if (key === "systematicity" && stepType === "commitments") return false;
    if (key === "faithfulness" && stepType === "theory") return false;
    return true;
  });
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        fontSize: 11,
        color: C.dim,
        flexWrap: "wrap",
      }}
    >
      {entries.map(({ label, value, color }) => (
        <span key={label}>
          <span style={{ color, fontWeight: "bold" }}>{label}</span>{" "}
          <span style={{ color: highlight ? C.text : C.dim }}>
            {fmt(value)}
          </span>
        </span>
      ))}
    </div>
  );
}

const SCORE_SERIES = [
  { key: "z", label: "Z-score", color: C.supports, width: 1 },
  { key: "account", label: "Account", color: C.judgment.high, width: 0.5 },
  {
    key: "systematicity",
    label: "Systematicity",
    color: C.principle.high,
    width: 0.5,
  },
  {
    key: "faithfulness",
    label: "Faithfulness",
    color: C.theory.high,
    width: 0.5,
  },
];

/** SVG line chart of Z, account, systematicity, and faithfulness over evolution steps. */
function ScoresChart({ scores }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [hiddenSeries, setHiddenSeries] = useState(new Set());

  const toggleSeries = (key) =>
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Measure the container so we can compute a compensating font size.
  // The SVG uses a fixed viewBox (keeping proportional scaling), and we derive
  // the label font size in SVG user units that renders as exactly 11 CSS px:
  //   labelSize = 11 × (viewBoxWidth / containerWidth)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pair each score with its step index; discard nulls (step 0 has no theory yet).
  const points = useMemo(
    () => scores.map((s, i) => (s ? { step: i, ...s } : null)).filter(Boolean),
    [scores],
  );

  if (points.length < 2) {
    return <div ref={containerRef} style={{ width: "100%" }} />;
  }

  const W = 300; // viewBox width (SVG user units)
  const H = 120; // viewBox height (SVG user units)
  const m = { top: 8, right: 10, bottom: 20, left: 28 };
  const iW = W - m.left - m.right;
  const iH = H - m.top - m.bottom;

  // Font size in SVG user units that renders as 11 CSS px at the current scale.
  const labelSize = containerWidth > 0 ? 11 * (W / containerWidth) : 9;

  // Auto-range y to the actual data with a little padding.
  const allValues = points.flatMap((d) =>
    SCORE_SERIES.map(({ key }) => d[key]),
  );
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const pad = Math.max((dataMax - dataMin) * 0.15, 0.02);
  const yMin = Math.max(0, dataMin - pad);
  const yMax = Math.min(1, dataMax + pad);

  const xMin = points[0].step;
  const xMax = points[points.length - 1].step;
  const xScale = scaleLinear().domain([xMin, xMax]).range([0, iW]);
  const yScale = scaleLinear().domain([yMin, yMax]).range([iH, 0]);

  const makePath = (key) =>
    d3Line()
      .x((d) => xScale(d.step))
      .y((d) => yScale(d[key]))
      .curve(curveMonotoneX)(points);

  const allSteps = points.map((p) => p.step);
  const labelEvery =
    allSteps.length <= 10 ? 1 : Math.ceil(allSteps.length / 10);
  const yTicks = scaleLinear().domain([yMin, yMax]).ticks(4);
  const fmtY = (v) => String(+v.toFixed(2));

  // Find the nearest data point by Euclidean distance in SVG user units.
  const THRESHOLD = 8; // SVG user units
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgPerPx = W / rect.width; // SVG user units per CSS px
    const svgX = (e.clientX - rect.left) * svgPerPx - m.left;
    const svgY = (e.clientY - rect.top) * svgPerPx - m.top;

    let minDist = Infinity;
    let best = null;
    for (const { key, label, color } of SCORE_SERIES.filter((s) => !hiddenSeries.has(s.key))) {
      for (const d of points) {
        const dist = Math.hypot(xScale(d.step) - svgX, yScale(d[key]) - svgY);
        if (dist < minDist) {
          minDist = dist;
          best = { d, key, label, color };
        }
      }
    }
    if (best && minDist < THRESHOLD) {
      const pxPerSvg = rect.width / W; // CSS px per SVG user unit
      setTooltip({
        cx: (xScale(best.d.step) + m.left) * pxPerSvg,
        cy: (yScale(best.d[best.key]) + m.top) * pxPerSvg,
        label: best.label,
        color: best.color,
        value: best.d[best.key],
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", marginTop: 4, marginBottom: 8 }}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <g transform={`translate(${m.left},${m.top})`}>
          {/* Transparent background rect to capture mouse events */}
          <rect x={0} y={0} width={iW} height={iH} fill="transparent" />

          {/* Y gridlines */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={0}
                x2={iW}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke={C.border}
                strokeWidth={0.5}
              />
              <text
                x={-4}
                y={yScale(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fill={C.dim}
                fontSize={labelSize}
              >
                {fmtY(t)}
              </text>
            </g>
          ))}

          {/* Lines */}
          {SCORE_SERIES.map(({ key, color, width }) =>
            hiddenSeries.has(key) ? null : (
              <path
                key={key}
                d={makePath(key)}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ),
          )}

          {/* Dots */}
          {SCORE_SERIES.map(({ key, color }) =>
            hiddenSeries.has(key)
              ? null
              : points.map((d) => (
                  <circle
                    key={`dot-${key}-${d.step}`}
                    cx={xScale(d.step)}
                    cy={yScale(d[key])}
                    r={0.5}
                    fill={color}
                  />
                )),
          )}

          {/* X-axis step labels */}
          {allSteps.map((s, idx) =>
            idx % labelEvery === 0 ? (
              <text
                key={s}
                x={xScale(s)}
                y={iH + 13}
                textAnchor="middle"
                fill={C.dim}
                fontSize={labelSize}
              >
                {s}
              </text>
            ) : null,
          )}
        </g>
      </svg>

      {/* Tooltip — CSS pixel coordinates, rendered at native font size */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.cx + 8,
            top: tooltip.cy - 26,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 11,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          <span style={{ color: tooltip.color, fontWeight: "bold" }}>
            {tooltip.label}
          </span>{" "}
          <span style={{ color: C.text }}>{tooltip.value.toFixed(3)}</span>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 11,
          color: C.dim,
        }}
      >
        {SCORE_SERIES.map(({ key, label, color, width }) => {
          const hidden = hiddenSeries.has(key);
          return (
            <span
              key={key}
              onClick={() => toggleSeries(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: hidden ? 0.4 : 1,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <svg width={14} height={4} style={{ flexShrink: 0 }}>
                <line x1={0} y1={2} x2={14} y2={2} stroke={color} strokeWidth={width * 2} />
              </svg>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EvolutionStep({ step, stepType, position, scores }) {
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
      {/* Element badges + scores */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: scores ? 4 : 0,
          }}
        >
          {position.length === 0 ? (
            <span style={{ color: C.dim }}>∅</span>
          ) : (
            position.map((e, i) => (
              <IdBadge key={i} element={e} negated={e.negated} />
            ))
          )}
        </div>
        <ScoreRow scores={scores} stepType={stepType} />
      </div>
    </div>
  );
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
  // Step-mode tracking: confirmed = accepted evolution; pending = awaiting accept/reject
  const [confirmedEvolution, setConfirmedEvolution] = useState(null);
  const [confirmedResult, setConfirmedResult] = useState(null);
  const [stepPending, setStepPending] = useState(false);
  const [loadingMode, setLoadingMode] = useState(null); // "simulate" | "step" | null
  const [error, setError] = useState(null);
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [decision, setDecision] = useState(null); // "accepted" | "rejected" | null

  const activeCount = state.elements.filter((e) =>
    ["active", "revised"].includes(e.status),
  ).length;

  const atLeastOneArgument =
    state.relations.filter(
      (r) => ARGUMENT_RELATION_TYPES.has(r.type),
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
        weights,
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
        weights,
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
    loadingMode !== null || activeCount < 3 || !atLeastOneArgument;

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
            {(() => {
              const scores = result?.translated_re_state.scores;
              const lastScore = scores?.findLast((s) => s != null) ?? null;
              return lastScore ? (
                <div style={{ marginBottom: 10 }}>
                  <ScoreRow scores={lastScore} highlight />
                </div>
              ) : null;
            })()}
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
            <ScoresChart scores={result.translated_re_state.scores ?? []} />
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
