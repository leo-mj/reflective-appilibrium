/**
 * @fileoverview Ternary / barycentric triangle input for three weights that
 * must sum to 1.  Drag the dot to adjust (account, systematicity, faithfulness)
 * simultaneously while keeping their sum exactly 1.
 *
 * Geometry
 * --------
 * An equilateral triangle with circumradius R has its vertices at:
 *
 *   VS  (Systematicity, top)        = (CX,           CY − R)
 *   VA  (Account,       btm-left)  = (CX − R·sin60,  CY + R/2)
 *   VF  (Faithfulness,  btm-right) = (CX + R·sin60,  CY + R/2)
 *
 * Any point P inside the triangle corresponds to barycentric coordinates
 * (a, s, f) via:
 *
 *   P = a·VA + s·VS + f·VF      (with a + s + f = 1)
 *
 * Inverting:
 *   s       = 1/3 − (2/3)·(py − CY)/R
 *   f − a   = (px − CX) / (R·sin60)
 *   a, f    = ((1−s) ∓ (f−a)) / 2
 *
 * Points dragged outside the triangle are projected onto its boundary by
 * clamping any negative coordinate to 0 and renormalising.
 */

import { useRef } from "react";
import { C } from "../../constants/colors.js";

// ─── Geometry ─────────────────────────────────────────────────────────────────

const W = 220;
const H = 200;
const CX = W / 2;      // horizontal centre
const CY = 112;        // vertical centre, shifted down to leave room for the top label
const R = 72;          // circumradius
const SIN60 = Math.sqrt(3) / 2;

const VS = { x: CX,             y: CY - R };        // Systematicity (top)
const VA = { x: CX - R * SIN60, y: CY + R / 2 };   // Account       (bottom-left)
const VF = { x: CX + R * SIN60, y: CY + R / 2 };   // Faithfulness  (bottom-right)

const TRI_PATH = `M ${VS.x},${VS.y} L ${VA.x},${VA.y} L ${VF.x},${VF.y} Z`;

// ─── Grid lines at 0.25 / 0.50 / 0.75 for each dimension ─────────────────────

function lerp(p, q, t) {
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

const TICKS = [0.25, 0.5, 0.75];

// Each entry is [start, end] of a grid line segment.
const GRID_LINES = [
  // Lines of constant s  (parallel to the VA–VF base)
  ...TICKS.map((k) => [lerp(VA, VS, k), lerp(VF, VS, k)]),
  // Lines of constant a  (parallel to VS–VF)
  ...TICKS.map((k) => [lerp(VS, VA, k), lerp(VF, VA, k)]),
  // Lines of constant f  (parallel to VS–VA)
  ...TICKS.map((k) => [lerp(VS, VF, k), lerp(VA, VF, k)]),
];

// ─── Coordinate transforms ────────────────────────────────────────────────────

/** Barycentric weights → SVG pixel position. */
function toPixel({ account: a, systematicity: s, faithfulness: f }) {
  return {
    x: a * VA.x + s * VS.x + f * VF.x,
    y: a * VA.y + s * VS.y + f * VF.y,
  };
}

/** SVG pixel position → barycentric weights (clamped to the triangle). */
function fromPixel(px, py) {
  const s = 1 / 3 - (2 / 3) * ((py - CY) / R);
  const fMinusA = (px - CX) / (R * SIN60);
  const aRaw = ((1 - s) - fMinusA) / 2;
  const fRaw = ((1 - s) + fMinusA) / 2;

  // Clamp negatives to 0; this projects outside-triangle positions to the
  // nearest point on the triangle boundary.
  const a = Math.max(0, aRaw);
  const sv = Math.max(0, s);
  const f = Math.max(0, fRaw);
  const total = a + sv + f;
  if (total === 0) return { account: 1 / 3, systematicity: 1 / 3, faithfulness: 1 / 3 };
  return { account: a / total, systematicity: sv / total, faithfulness: f / total };
}

// ─── Vertex metadata ─────────────────────────────────────────────────────────

const VERTICES = [
  {
    vertex: VS,
    key: "systematicity",
    label: "Systematicity",
    // label offset from vertex tip (dy[0] = label row, dy[1] = value row)
    labelDy: [-18, -7],
    tooltip:
      "Systematising power of the theory — favour using fewer principles to cover more elements.",
  },
  {
    vertex: VA,
    key: "account",
    label: "Account",
    labelDy: [17, 28],
    tooltip:
      "How well the principles account for the current elements. Higher values push toward principles that explain more of your accepted elements.",
  },
  {
    vertex: VF,
    key: "faithfulness",
    label: "Faithfulness",
    labelDy: [17, 28],
    tooltip:
      "How closely the revised commitments stay to the initial ones. Higher values resist dropping elements that were initially accepted.",
  },
];

// Default weights (must match DEFAULT_WEIGHTS in SimulateRethonTab)
const DEFAULT_DOT = toPixel({ account: 0.35, systematicity: 0.55, faithfulness: 0.1 });

// ─── Component ────────────────────────────────────────────────────────────────

const ACCENT = C.principle.accent;

/**
 * @param {{ account: number, systematicity: number, faithfulness: number }} weights
 * @param {(w: { account: number, systematicity: number, faithfulness: number }) => void} onChange
 * @param {boolean} [weightsChanged]
 */
export function WeightTriangle({ weights, onChange, weightsChanged = false }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);

  function handlePointerEvent(e) {
    const rect = svgRef.current.getBoundingClientRect();
    onChange(fromPixel(e.clientX - rect.left, e.clientY - rect.top));
  }

  const dot = toPixel(weights);

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      style={{
        display: "block",
        cursor: "crosshair",
        userSelect: "none",
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        handlePointerEvent(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) handlePointerEvent(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {/* Triangle fill */}
      <path d={TRI_PATH} style={{ fill: C.panel, stroke: "none" }} />

      {/* Grid lines */}
      {GRID_LINES.map(([p1, p2], i) => (
        <line
          key={i}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          style={{ stroke: C.border, strokeWidth: 0.5, opacity: 0.7 }}
        />
      ))}

      {/* Triangle border */}
      <path
        d={TRI_PATH}
        style={{ fill: "none", stroke: C.border, strokeWidth: 1.5 }}
      />

      {/* Vertex labels + current values */}
      {VERTICES.map(({ vertex, key, label, labelDy, tooltip }) => (
        <g key={key}>
          <text
            x={vertex.x}
            y={vertex.y + labelDy[0]}
            textAnchor="middle"
            fontSize={10}
            style={{ fill: C.dim, pointerEvents: "none" }}
          >
            <title>{tooltip}</title>
            {label}
          </text>
          <text
            x={vertex.x}
            y={vertex.y + labelDy[1]}
            textAnchor="middle"
            fontSize={11}
            fontWeight="bold"
            style={{ fill: ACCENT, pointerEvents: "none" }}
          >
            {weights[key].toFixed(2)}
          </text>
        </g>
      ))}

      {/* Ghost marker at the default position (shown only when weights differ) */}
      {weightsChanged && (
        <circle
          cx={DEFAULT_DOT.x}
          cy={DEFAULT_DOT.y}
          r={5}
          style={{
            fill: "none",
            stroke: C.dim,
            strokeWidth: 1,
            strokeDasharray: "2 2",
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Drag handle */}
      <circle
        cx={dot.x}
        cy={dot.y}
        r={7}
        style={{ fill: ACCENT, opacity: 0.9, pointerEvents: "none" }}
      />
      <circle
        cx={dot.x}
        cy={dot.y}
        r={7}
        style={{ fill: "none", stroke: "white", strokeWidth: 1.5, pointerEvents: "none" }}
      />
      <circle
        cx={dot.x}
        cy={dot.y}
        r={2}
        style={{ fill: "white", pointerEvents: "none" }}
      />
    </svg>
  );
}
