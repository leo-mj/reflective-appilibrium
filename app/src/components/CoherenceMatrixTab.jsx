/**
 * @fileoverview Relatedness matrix tab — calls the OpenAI API to score
 * how conceptually related each pair of judgment and principle elements is,
 * then renders the result as a colour-coded heatmap table.
 * @module components/CoherenceMatrixTab
 */

/** @import { REState, REElement } from '../types.js' */

import { useState } from "react";
import OpenAI from "openai";
import { C } from "../constants/colors.js";

/**
**Dummy matrix** (`dummy-matrix.js`) — a rich fixture used during development.
 *    Activated by setting the `VITE_USE_DUMMY_MATRIX=true` environment variable
 *    (see `.env` in the project root).
 */

import _dummyMatrix from "../dummy-matrix.js";

// ─── OpenAI configuration ─────────────────────────────────────────────────────

/** Loaded from VITE_OPENAI_API_KEY in app/.env */
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/** OpenAI model to use. Update here to switch models. */
const OPENAI_MODEL = "gpt-5.4-mini";

/** OpenAI client instance. */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true });

// ─── Colour helpers ───────────────────────────────────────────────────────────

/**
 * Interpolates between `C.panel` (#1e293b) at score 0 and `C.supports`
 * (#06b6d4) at score 1 to produce a heatmap cell background colour.
 *
 * @param {number} score - Value in [0, 1].
 * @returns {string} CSS `rgb(...)` string.
 */
function heatColor(score) {
  const lo = [30, 41, 59];    // C.panel   #1e293b
  const hi = [6, 182, 212];   // C.supports #06b6d4
  const r = Math.round(lo[0] + (hi[0] - lo[0]) * score);
  const g = Math.round(lo[1] + (hi[1] - lo[1]) * score);
  const b = Math.round(lo[2] + (hi[2] - lo[2]) * score);
  return `rgb(${r},${g},${b})`;
}

/** Text colour that remains legible on the heatmap cell background. */
const cellTextColor = (score) => score > 0.55 ? "#0f172a" : C.dim;

// ─── OpenAI API call ──────────────────────────────────────────────────────────

/**
 * Builds the prompt, calls the OpenAI chat completions endpoint, and returns
 * the parsed JSON result.
 *
 * @param {string}      topic    - RE topic string shown to the model.
 * @param {REElement[]} elements - Non-withdrawn judgments and principles.
 * @returns {Promise<{ overview: string, matrix: Object, pairDescriptions: Object }>}
 */
async function fetchRelatednessMatrix(topic, elements) {
  const useDummyMatrix = import.meta.env.VITE_USE_DUMMY_MATRIX
  if (useDummyMatrix) {
    return JSON.parse(_dummyMatrix);
  }
  const elementList = elements
    .map(e => `${e.id} [${e.type}]: ${e.text}`)
    .join("\n");

  const prompt = `\
You are assisting a wide reflective equilibrium (RE) analysis in ethics.
Topic: "${topic}"

Elements (judgments and principles):
${elementList}

Task: compute a symmetric relatedness matrix.
- Score each ordered pair (including diagonal) from 0.0 (completely unrelated) to 1.0 (identical or directly equivalent).
- Diagonal entries must be 1.0.
- For each off-diagonal unordered pair, provide a one-sentence description. Use the key "A→B" where A and B are sorted according to JavaScript string array sorting (.sort()), 
so that ["J12", "J10", "J1", "J3"].sort() results in [ 'J1', 'J10', 'J12', 'J3' ].
- Write a 2–3 sentence overview of the overall element landscape.

Respond with valid JSON only, in exactly this format:
{
  "overview": "...",
  "matrix": { "J1": { "J1": 1.0, "J2": 0.6, "P1": 0.4 }, "J2": { "J1": 0.6, "J2": 1.0, "P1": 0.9 }, "P1": { "J1": 0.4, "J2": 0.9, "P1": 1.0 } },
  "pairDescriptions": { "J1→J2": "Brief description of how J1 and J2 relate." }
}`;

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    temperature: 0.3,
    text: { format: { type: "json_object" } },
  });

  return JSON.parse(response.output_text);
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
  /** @type {[{rowId:string, colId:string, desc:string|undefined}|null, function]} */
  const [hovered, setHovered] = useState(null);

  const elements = state.elements.filter(
    e => e.status !== "withdrawn" && (e.type === "judgment" || e.type === "principle")
  );

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "0 4px 24px" }}>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 14px", gap: 12 }}>
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
          Relatedness matrix for{" "}
          <span style={{ color: C.text, fontWeight: "bold" }}>{elements.length}</span>{" "}
          elements (judgments + principles), scored by {OPENAI_MODEL}.
        </div>
        <button
          onClick={analyze}
          disabled={loading || elements.length < 2}
          style={{
            background: loading ? C.border : C.supports,
            border: "none", color: "#fff", borderRadius: 6,
            padding: "6px 14px", fontSize: 12, fontWeight: "bold",
            cursor: loading || elements.length < 2 ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}>
          {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: "#7c1d1d44", border: "1px solid #dc2626",
          borderRadius: 6, padding: "10px 14px",
          fontSize: 12, color: "#fca5a5", marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {elements.length < 2 && (
        <div style={{ fontSize: 12, color: C.dim }}>
          Add at least two non-withdrawn judgments or principles to run the analysis.
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <>
          {/* Overview */}
          {result.overview && (
            <div style={{
              fontSize: 12, color: C.dim, lineHeight: 1.7, marginBottom: 18,
              padding: "10px 14px", background: C.panel, borderRadius: 6,
              border: `1px solid ${C.border}`,
            }}>
              <span style={{ fontWeight: "bold", color: C.text }}>Overview: </span>
              {result.overview}
            </div>
          )}

          {/* Heatmap table */}
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
                      const isDiag = row.id === col.id;
                      const desc = result.pairDescriptions?.[`${row.id}→${col.id}`]
                                ?? result.pairDescriptions?.[`${col.id}→${row.id}`];
                      const isHov = hovered?.rowId === row.id && hovered?.colId === col.id;
                      return (
                        <td
                          key={col.id}
                          onMouseEnter={() => setHovered({ rowId: row.id, colId: col.id, desc })}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            minWidth: 48, height: 36, textAlign: "center",
                            background: heatColor(score),
                            border: isHov ? `1px solid ${C.text}` : `1px solid ${C.bg}`,
                            color: cellTextColor(score),
                            fontWeight: isDiag ? "bold" : "normal",
                            cursor: desc ? "pointer" : "default",
                            transition: "border 0.15s ease",
                          }}>
                          {score.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Hovered pair description */}
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
                {hovered.desc ?? "Element compared with itself."}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
