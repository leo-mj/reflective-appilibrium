/**
 * @fileoverview Relatedness matrix tab — calls the OpenAI API to score
 * how conceptually related each pair of judgment and principle elements is,
 * then renders the result as a colour-coded heatmap table.
 * @module components/CoherenceMatrixTab
 */

/** @import { REState, REElement } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";
import _dummyMatrix from "../dummy-matrix.js";
import { callOpenAIAPI, OPENAI_MODEL } from "../utils/openaiClient.js";

// ─── Colour helpers ───────────────────────────────────────────────────────────

/**
 * Interpolates between `C.panel` (#1e293b) at score 0 and `C.supports`
 * (#06b6d4) at score 1 to produce a heatmap cell background colour.
 *
 * @param {number} score - Value in [0, 1].
 * @returns {string} CSS `rgb(...)` string.
 */
function heatColor(score) {
  const lo = [30, 41, 59];   // C.panel    #1e293b
  const hi = [6, 182, 212];  // C.supports #06b6d4
  const ch = (i) => Math.round(lo[i] + (hi[i] - lo[i]) * score);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

/** Text colour that remains legible on the heatmap cell background. */
const cellTextColor = (score) => score > 0.55 ? "#0f172a" : C.dim;

// ─── Element filtering ────────────────────────────────────────────────────────

/**
 * Returns non-withdrawn judgments and principles from the RE state.
 *
 * @param {REState} state
 * @returns {REElement[]}
 */
function getAnalysisElements(state) {
  return state.elements.filter(
    e => e.status !== "withdrawn" && (e.type === "judgment" || e.type === "principle")
  );
}

// ─── Prompt building ──────────────────────────────────────────────────────────

/**
 * Builds the prompt string for the relatedness matrix request.
 *
 * @param {string}      topic
 * @param {REElement[]} elements
 * @returns {string}
 */
function buildPrompt(topic, elements) {
  const elementList = elements
    .map(e => `${e.id} [${e.type}]: ${e.text}`)
    .join("\n");

  return `\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "${topic}"

Elements (judgments and principles):
${elementList}

Task: compute a symmetric relatedness matrix.
- Score each ordered pair (including diagonal) from 0.0 (completely unrelated) to 1.0 (identical or directly equivalent).
- Diagonal entries must be 1.0.
- For each off-diagonal unordered pair, provide a one-sentence description. Use the key "A→B" where A and B are sorted according to JavaScript string array sorting (.sort()), \
so that ["J12", "J10", "J1", "J3"].sort() results in [ 'J1', 'J10', 'J12', 'J3' ].
- Write a 2–3 sentence overview of the overall element landscape.

Respond with valid JSON only, in exactly this format:
{
  "overview": "...",
  "matrix": { "J1": { "J1": 1.0, "J2": 0.6, "P1": 0.4 }, "J2": { "J1": 0.6, "J2": 1.0, "P1": 0.9 }, "P1": { "J1": 0.4, "J2": 0.9, "P1": 1.0 } },
  "pairDescriptions": { "J1→J2": "Brief description of how J1 and J2 relate." }
}`;
}

// ─── LLM API call ──────────────────────────────────────────────────────────

/**
 * Calls an LLM API and returns the parsed JSON result.
 *
 * @param {string} prompt
 * @returns {Promise<{ overview: string, matrix: Object, pairDescriptions: Object }>}
 */
async function callLLMAPI(prompt) {
  const outputText = await callOpenAIAPI(prompt)
  return JSON.parse(outputText);
}

/**
 * Builds the prompt, calls an LLM API (or returns the dummy fixture), and
 * returns the parsed relatedness matrix result.
 *
 * @param {string}      topic
 * @param {REElement[]} elements
 * @returns {Promise<{ overview: string, matrix: Object, pairDescriptions: Object }>}
 */
async function fetchRelatednessMatrix(topic, elements) {
  if (import.meta.env.VITE_USE_DUMMY_MATRIX) {
    return JSON.parse(_dummyMatrix);
  }
  return callLLMAPI(buildPrompt(topic, elements));
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
  return pairDescriptions?.[`${idA}→${idB}`] ?? pairDescriptions?.[`${idB}→${idA}`];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Toolbar with element count summary and Analyze button.
 *
 * @param {Object}   props
 * @param {number}   props.elementCount
 * @param {boolean}  props.loading
 * @param {boolean}  props.hasResult
 * @param {Function} props.onAnalyze
 */
function Toolbar({ elementCount, loading, hasResult, onAnalyze }) {
  const disabled = loading || elementCount < 2;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0 14px", gap: 12,
    }}>
      <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
        Relatedness matrix for{" "}
        <span style={{ color: C.text, fontWeight: "bold" }}>{elementCount}</span>{" "}
        elements (judgments + principles), scored by {OPENAI_MODEL}.
      </div>
      <button
        onClick={onAnalyze}
        disabled={disabled}
        style={{
          background: loading ? C.border : C.supports,
          border: "none", color: "#fff", borderRadius: 6,
          padding: "6px 14px", fontSize: 12, fontWeight: "bold",
          cursor: disabled ? "not-allowed" : "pointer",
          flexShrink: 0,
        }}>
        {loading ? "Analyzing…" : hasResult ? "Re-analyze" : "Analyze"}
      </button>
    </div>
  );
}

/**
 * Red error banner.
 *
 * @param {Object} props
 * @param {string} props.message
 */
function ErrorBanner({ message }) {
  return (
    <div style={{
      background: "#7c1d1d44", border: "1px solid #dc2626",
      borderRadius: 6, padding: "10px 14px",
      fontSize: 12, color: "#fca5a5", marginBottom: 14,
    }}>
      {message}
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
    <div style={{
      fontSize: 12, color: C.dim, lineHeight: 1.7, marginBottom: 18,
      padding: "10px 14px", background: C.panel, borderRadius: 6,
      border: `1px solid ${C.border}`,
    }}>
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
function HeatCell({ score, isDiag, desc, isHovered, onMouseEnter, onMouseLeave }) {
  return (
    <td
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        minWidth: 48, height: 36, textAlign: "center",
        background: heatColor(score),
        border: isHovered ? `1px solid ${C.text}` : `1px solid ${C.bg}`,
        color: cellTextColor(score),
        fontWeight: isDiag ? "bold" : "normal",
        cursor: desc ? "pointer" : "default",
        transition: "border 0.15s ease",
      }}>
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
            {elements.map(e => (
              <th key={e.id} style={{
                padding: "4px 6px", color: C.dim, fontWeight: "normal",
                textAlign: "center", fontSize: 10, minWidth: 48,
              }}>
                {e.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {elements.map(row => (
            <tr key={row.id}>
              <td style={{
                paddingRight: 8, color: C.dim, fontSize: 10,
                whiteSpace: "nowrap", fontWeight: "normal",
              }}>
                {row.id}
              </td>
              {elements.map(col => {
                const score = result.matrix?.[row.id]?.[col.id] ?? 0;
                const desc  = getPairDesc(result.pairDescriptions, row.id, col.id);
                return (
                  <HeatCell
                    key={col.id}
                    score={score}
                    isDiag={row.id === col.id}
                    desc={desc}
                    isHovered={hovered?.rowId === row.id && hovered?.colId === col.id}
                    onMouseEnter={() => onCellEnter({ rowId: row.id, colId: col.id, desc })}
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
  if (hovered == null) return
  const desc = hovered.rowId === hovered.colId
    ? "Element compared with itself."
    : hovered.desc ?? "No description available.";
  return (
    <div style={{
      minHeight: 40, paddingTop: 10, fontSize: 11,
      color: C.dim, lineHeight: 1.6,
      opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease",
    }}>
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
export function CoherenceMatrixTab({ state }) {
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  /** @type {[{rowId:string, colId:string, desc:string|undefined}|null, Function]} */
  const [hovered, setHovered] = useState(null);

  const elements = getAnalysisElements(state);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchRelatednessMatrix(state.topic, elements));
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
      />

      {error && <ErrorBanner message={error} />}

      {elements.length < 2 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          Add at least two non-withdrawn judgments or principles to run the analysis.
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
