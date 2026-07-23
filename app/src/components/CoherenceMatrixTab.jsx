/**
 * @fileoverview Relatedness matrix tab — calls the OpenAI API to score
 * how conceptually related each pair of judgment and principle elements is,
 * then renders the result as a colour-coded heatmap table.
 * @module components/CoherenceMatrixTab
 */

/** @import { REState, REElement } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";
import { fetchRelatednessMatrix } from "../utils/matrixClient.js";
import { ErrorBanner, AiDisclosureBanner } from "./SuggestionActions.jsx";
import { Tooltip } from "./Tooltip.jsx";
import { sendsToLlmText } from "../utils/openaiClient.js";

// ─── Colour helpers ───────────────────────────────────────────────────────────

/**
 * Interpolates between `C.panel` (#1e293b) at score 0 and `C.supports`
 * (#06b6d4) at score 1 to produce a heatmap cell background colour.
 *
 * @param {number} score - Value in [0, 1].
 * @returns {string} CSS `rgb(...)` string.
 */
function heatColor(score) {
  const lo = [30, 41, 59]; // C.panel    #1e293b
  const hi = [6, 182, 212]; // C.supports #06b6d4
  const ch = (i) => Math.round(lo[i] + (hi[i] - lo[i]) * score);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

/** Text colour that remains legible on the heatmap cell background. */
const cellTextColor = (score) => (score > 0.55 ? "#0f172a" : C.dim);

// ─── Element filtering ────────────────────────────────────────────────────────

/**
 * Returns non-withdrawn judgments and principles from the RE state.
 *
 * @param {REState} state
 * @returns {REElement[]}
 */
function getAnalysisElements(state) {
  return state.elements.filter(
    (e) =>
      e.status !== "withdrawn" &&
      e.status !== "possible" &&
      (e.type === "judgment" || e.type === "principle"),
  );
}

// ─── Pair description lookup ──────────────────────────────────────────────────

/**
 * Looks up a pair description tolerating either key order (`A→B` or `B→A`).
 *
 * @param {Object} pairDescriptions - The `pairDescriptions` map from the API result.
 * @param {string} idA
 * @param {string} idB
 * @returns {string|undefined}
 */
function getPairDesc(pairDescriptions, idA, idB) {
  return (
    pairDescriptions?.[`${idA}→${idB}`] ?? pairDescriptions?.[`${idB}→${idA}`]
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Toolbar with element count summary and Analyze button.
 *
 * @param {Object}   props
 * @param {number}          props.elementCount
 * @param {boolean}         props.loading
 * @param {boolean}         props.hasResult
 * @param {Function}        props.onAnalyze
 * @param {string|undefined} props.model
 */
function Toolbar({
  elementCount,
  loading,
  hasResult,
  onAnalyze,
  model,
  suggestionsDisabled,
}) {
  const disabled = loading || elementCount < 2 || suggestionsDisabled;
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
      <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
        Relatedness matrix for{" "}
        <span style={{ color: C.text, fontWeight: "bold" }}>
          {elementCount}
        </span>{" "}
        elements (judgments + principles){model ? `, scored by ${model}` : ""}.
      </div>
      <Tooltip text={sendsToLlmText("your elements")}>
        <button
          onClick={onAnalyze}
          disabled={disabled}
          style={{
            background: loading ? C.border : C.supports,
            border: "none",
            color: "#fff",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: "bold",
            cursor: disabled ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "Analyzing…" : hasResult ? "Re-analyze" : "Analyze"}
        </button>
      </Tooltip>
    </div>
  );
}


/**
 * Overview paragraph rendered above the heatmap.
 *
 * @param {Object} props
 * @param {string} props.text
 */
function Overview({ text }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: C.dim,
        lineHeight: 1.7,
        marginBottom: 18,
        padding: "10px 14px",
        background: C.panel,
        borderRadius: 6,
        border: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontWeight: "bold", color: C.text }}>Overview: </span>
      {text}
    </div>
  );
}

/**
 * Single heatmap cell.
 *
 * @param {Object}          props
 * @param {number}          props.score
 * @param {boolean}         props.isDiag
 * @param {string|undefined} props.desc
 * @param {boolean}         props.isHovered
 * @param {Function}        props.onMouseEnter
 * @param {Function}        props.onMouseLeave
 */
function HeatCell({
  score,
  isDiag,
  desc,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}) {
  return (
    <td
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        minWidth: 48,
        height: 36,
        textAlign: "center",
        background: heatColor(score),
        border: isHovered ? `1px solid ${C.text}` : `1px solid ${C.bg}`,
        color: cellTextColor(score),
        fontWeight: isDiag ? "bold" : "normal",
        cursor: desc ? "pointer" : "default",
        transition: "border 0.15s ease",
      }}
    >
      {score.toFixed(2)}
    </td>
  );
}

/**
 * Full heatmap table.
 *
 * @param {Object}   props
 * @param {REElement[]} props.elements
 * @param {Object}   props.result        - API result with `matrix` and `pairDescriptions`.
 * @param {Object|null} props.hovered    - `{ rowId, colId }` of the currently hovered cell.
 * @param {Function} props.onCellEnter   - Called with `{ rowId, colId, desc }`.
 * @param {Function} props.onCellLeave
 */
function HeatmapTable({ elements, result, hovered, onCellEnter, onCellLeave }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ width: 40 }} />
            {elements.map((e) => (
              <th
                key={e.id}
                style={{
                  padding: "4px 6px",
                  color: C.dim,
                  fontWeight: "normal",
                  textAlign: "center",
                  fontSize: 10,
                  minWidth: 48,
                }}
              >
                {e.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {elements.map((row) => (
            <tr key={row.id}>
              <td
                style={{
                  paddingRight: 8,
                  color: C.dim,
                  fontSize: 10,
                  whiteSpace: "nowrap",
                  fontWeight: "normal",
                }}
              >
                {row.id}
              </td>
              {elements.map((col) => {
                const score = result.matrix?.[row.id]?.[col.id] ?? 0;
                const desc = getPairDesc(
                  result.pairDescriptions,
                  row.id,
                  col.id,
                );
                return (
                  <HeatCell
                    key={col.id}
                    score={score}
                    isDiag={row.id === col.id}
                    desc={desc}
                    isHovered={
                      hovered?.rowId === row.id && hovered?.colId === col.id
                    }
                    onMouseEnter={() =>
                      onCellEnter({ rowId: row.id, colId: col.id, desc })
                    }
                    onMouseLeave={onCellLeave}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pair description shown below the table when a cell is hovered.
 *
 * @param {Object|null} props.hovered - `{ rowId, colId, desc }` or null.
 */
function PairDescription({ hovered }) {
  if (hovered === null || hovered === undefined) return;
  const desc =
    hovered.rowId === hovered.colId
      ? "Element compared with itself."
      : (hovered.desc ?? "No description available.");
  return (
    <div
      style={{
        minHeight: 40,
        paddingTop: 10,
        fontSize: 11,
        color: C.dim,
        lineHeight: 1.6,
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.2s ease",
      }}
    >
      {hovered && (
        <>
          <span style={{ fontWeight: "bold", color: C.text }}>
            {hovered.rowId} × {hovered.colId}:
          </span>{" "}
          {desc}
        </>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders the Relatedness Matrix tab.
 *
 * Filters the state to non-withdrawn judgments and principles, then on user
 * request calls the OpenAI API to produce a relatedness score matrix and a
 * brief description per pair.  The result is displayed as a colour-coded
 * heatmap table; hovering a cell shows the pair description below the table.
 *
 * @param {Object}  props
 * @param {REState} props.state
 * @returns {React.ReactElement}
 */
export function CoherenceMatrixTab({ state, suggestionsDisabled = false }) {
  /** @type {[{overview: string, matrix: Object, pairDescriptions: Object, _model: string}|null, Function]} */
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  /** @type {[{rowId:string, colId:string, desc:string|undefined}|null, Function]} */
  const [hovered, setHovered] = useState(null);

  const elements = getAnalysisElements(state);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchRelatednessMatrix(state));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "0 4px 24px" }}>
      <Toolbar
        elementCount={elements.length}
        loading={loading}
        hasResult={!!result}
        onAnalyze={analyze}
        model={result?._model}
        suggestionsDisabled={suggestionsDisabled}
      />

      {error && <ErrorBanner message={error} />}
      {result && (
        <AiDisclosureBanner
          model={result._model}
          note="Review carefully — scores and descriptions can be wrong."
        />
      )}

      {elements.length < 2 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          Add at least two non-withdrawn judgments or principles to run the
          analysis.
        </div>
      )}

      {result && (
        <>
          {result.overview && <Overview text={result.overview} />}

          <HeatmapTable
            elements={elements}
            result={result}
            hovered={hovered}
            onCellEnter={setHovered}
            onCellLeave={() => setHovered(null)}
          />

          <PairDescription hovered={hovered} />
        </>
      )}
    </div>
  );
}
