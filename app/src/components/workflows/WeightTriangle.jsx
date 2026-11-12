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
 * A drag starts only from a press inside the triangle or on the handle; once
 * started, points dragged outside it are projected onto its boundary by
 * clamping any negative coordinate to 0 and renormalising.
 */

import { useRef, useState } from "react";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { DEFAULT_WEIGHTS } from "../../constants/simulationWeights.js";

// ─── Geometry ─────────────────────────────────────────────────────────────────

const W = 220;
/** How wide the triangle draws itself, for whatever has to make room for it. */
export const WEIGHT_TRIANGLE_WIDTH = W;
const H = 200;
const CX = W / 2; // horizontal centre
const CY = 112; // vertical centre, shifted down to leave room for the top label
const R = 72; // circumradius
const SIN60 = Math.sqrt(3) / 2;

const VS = { x: CX, y: CY - R }; // Systematicity (top)
const VA = { x: CX - R * SIN60, y: CY + R / 2 }; // Account       (bottom-left)
const VF = { x: CX + R * SIN60, y: CY + R / 2 }; // Faithfulness  (bottom-right)

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

/** SVG pixel position → barycentric weights, unclamped: negative outside. */
function barycentric(px, py) {
  const s = 1 / 3 - (2 / 3) * ((py - CY) / R);
  const fMinusA = (px - CX) / (R * SIN60);
  return {
    a: (1 - s - fMinusA) / 2,
    s,
    f: (1 - s + fMinusA) / 2,
  };
}

/** Radius of the drag handle, and of the area a press on it is taken in. */
const DOT_R = 7;

/**
 * Whether a press at this pixel may start a drag: inside the triangle, or on
 * the handle, which overhangs the border when a weight is 0. Only the start is
 * held to this — a drag already under way may leave the triangle and is
 * projected back onto it.
 */
function startsDrag(px, py, dot) {
  const { a, s, f } = barycentric(px, py);
  if (Math.min(a, s, f) >= 0) return true;
  return Math.hypot(px - dot.x, py - dot.y) <= DOT_R + 2;
}

/** SVG pixel position → barycentric weights (clamped to the triangle). */
function fromPixel(px, py) {
  const { a: aRaw, s, f: fRaw } = barycentric(px, py);

  // Clamp negatives to 0; this projects outside-triangle positions to the
  // nearest point on the triangle boundary.
  const a = Math.max(0, aRaw);
  const sv = Math.max(0, s);
  const f = Math.max(0, fRaw);
  const total = a + sv + f;
  if (total === 0)
    return { account: 1 / 3, systematicity: 1 / 3, faithfulness: 1 / 3 };
  return {
    account: a / total,
    systematicity: sv / total,
    faithfulness: f / total,
  };
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
      "How much the principles and background theories imply, relative to how many there are. Higher values favour fewer of them implying more.",
  },
  {
    vertex: VA,
    key: "account",
    label: "Account",
    labelDy: [17, 28],
    tooltip:
      "How well the principles and background theories account for the commitments. Higher values push toward a theory that implies what you accept, and the negation of what you reject, contradicting neither.",
  },
  {
    vertex: VF,
    key: "faithfulness",
    label: "Faithfulness",
    labelDy: [17, 28],
    tooltip:
      "How close the commitments stay to the position the simulation started from. Higher values resist giving up or reversing a commitment; taking up a new one costs nothing.",
  },
];

const DEFAULT_DOT = toPixel(DEFAULT_WEIGHTS);

// ─── Component ────────────────────────────────────────────────────────────────

const ACCENT = C.principle.accent;

/**
 * @param {{ account: number, systematicity: number, faithfulness: number }} weights
 * @param {(w: { account: number, systematicity: number, faithfulness: number }) => void} onChange
 * @param {boolean} [weightsChanged]
 */
export function WeightTriangle({ weights, onChange, weightsChanged = false }) {
  const svgRef = useRef(null);
  // State rather than a ref, because the cursor follows it: a drag carried
  // out of the triangle keeps the crosshair.
  const [dragging, setDragging] = useState(false);

  function pointAt(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  const dot = toPixel(weights);

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      style={{
        display: "block",
        // Off the triangle a press does nothing, so only the triangle and the
        // handle show the crosshair (each sets its own), except mid-drag.
        cursor: dragging ? "crosshair" : "default",
        userSelect: "none",
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        const [px, py] = pointAt(e);
        if (!startsDrag(px, py, dot)) return;
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(fromPixel(px, py));
      }}
      onPointerMove={(e) => {
        if (dragging) onChange(fromPixel(...pointAt(e)));
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {/* Triangle fill — the press target */}
      <path
        d={TRI_PATH}
        style={{ fill: C.panel, stroke: "none", cursor: "crosshair" }}
      />

      {/* Grid lines */}
      {GRID_LINES.map(([p1, p2], i) => (
        <line
          key={i}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          style={{
            stroke: C.border,
            strokeWidth: 0.5,
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Triangle border */}
      <path
        d={TRI_PATH}
        style={{
          fill: "none",
          stroke: C.border,
          strokeWidth: 1.5,
          pointerEvents: "none",
        }}
      />

      {/* Vertex labels + current values */}
      {VERTICES.map(({ vertex, key, label, labelDy, tooltip }) => (
        <g key={key}>
          {/* The app's own tooltip rather than an SVG <title>, which drew the
              browser's box — and never did, the label taking no pointer. */}
          <Tooltip text={tooltip}>
            <text
              x={vertex.x}
              y={vertex.y + labelDy[0]}
              textAnchor="middle"
              fontSize={10}
              style={{ fill: C.dim }}
            >
              {label}
            </text>
          </Tooltip>
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
        r={DOT_R}
        style={{ fill: ACCENT, opacity: 0.9, pointerEvents: "none" }}
      />
      <circle
        cx={dot.x}
        cy={dot.y}
        r={DOT_R}
        style={{
          fill: "none",
          stroke: "white",
          strokeWidth: 1.5,
          pointerEvents: "none",
        }}
      />
      <circle
        cx={dot.x}
        cy={dot.y}
        r={2}
        style={{ fill: "white", pointerEvents: "none" }}
      />
      {/* The handle's hover area, for the part of it overhanging the border */}
      <circle
        cx={dot.x}
        cy={dot.y}
        r={DOT_R + 2}
        style={{ fill: "transparent", cursor: "crosshair" }}
      />
    </svg>
  );
}
