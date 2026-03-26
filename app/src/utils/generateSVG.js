/**
 * @fileoverview Pure SVG string generator for RE graph export.
 * No React or DOM dependency — works at export time regardless of which tab is active.
 * @module utils/generateSVG
 */

/** @import { REElement, RERelation, PositionMap } from '../types.js' */

import { C, getColors, confOp } from "../constants/colors.js";
import { nodeRadius, arrowGeometry, edgeDashArray } from "./graphHelpers.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = 70; // px of whitespace around the bounding box
const M = "x"; // marker-id prefix — avoids collisions if multiple SVGs land in one doc
const REL_TYPES = ["supports", "conflicts", "undermines", "depends"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rounds a float to 1 decimal place for compact SVG attributes. */
const f = (n) => +n.toFixed(1);

/** Encodes an SVG string as a base64 data-URL for use in `<img src="...">`. */
export function svgToDataUrl(svg) {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

// ─── <defs> ───────────────────────────────────────────────────────────────────

function buildDefs() {
  const markers = REL_TYPES.flatMap((t) =>
    [false, true].map((w) => {
      const id = `${M}a-${t}${w ? "-w" : ""}`;
      const color = w ? C.withdrawn : C[t];
      const op = w ? 0.3 : 1;
      return (
        `<marker id="${id}" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">` +
        `<path d="M0,-5L10,0L0,5" fill="${color}" opacity="${op}"/></marker>`
      );
    }),
  );
  return `<defs>${markers.join("")}</defs>`;
}

// ─── Edge ─────────────────────────────────────────────────────────────────────

function edgeSVG(r, byId, positions, ox, oy) {
  const sp = positions[r.from];
  const tp = positions[r.to];
  if (!sp || !tp) return "";
  const isW = r.status === "withdrawn";
  const { x1, y1, x2, y2 } = arrowGeometry(
    sp,
    tp,
    nodeRadius(byId[r.from]?.type),
    nodeRadius(byId[r.to]?.type),
  );
  const color = isW ? C.withdrawn : C[r.type];
  const op = isW ? 0.25 : 1;
  const dash = edgeDashArray(r.type);
  const marker = `${M}a-${r.type}${isW ? "-w" : ""}`;
  const da = dash !== "none" ? ` stroke-dasharray="${dash}"` : "";
  return (
    `<line x1="${f(x1 - ox)}" y1="${f(y1 - oy)}" x2="${f(x2 - ox)}" y2="${f(y2 - oy)}"` +
    ` stroke="${color}" stroke-width="2" opacity="${op}"${da} marker-end="url(#${marker})"/>`
  );
}

// ─── Node ─────────────────────────────────────────────────────────────────────

function nodeSVG(el, positions, ox, oy) {
  const pos = positions[el.id];
  if (!pos) return "";
  const { fill, stroke } = getColors(el);
  const op = confOp[el.confidence] ?? 1;
  const r = nodeRadius(el.type);
  const cx = f(pos.x - ox);
  const cy = f(pos.y - oy);

  let shape;
  if (el.type === "principle") {
    const rw = f(r * 2.2),
      rh = f(r * 1.5);
    shape =
      `<rect x="${f(-rw / 2)}" y="${f(-rh / 2)}" width="${rw}" height="${rh}" rx="8"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="2" opacity="${op}"/>`;
  } else if (el.type === "theory") {
    shape =
      `<polygon points="0,${f(-r)} ${r},0 0,${r} ${f(-r)},0"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="2" opacity="${op}"/>`;
  } else {
    shape = `<circle r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2" opacity="${op}"/>`;
  }

  const label =
    `<text dy="${r + 14}" text-anchor="middle"` +
    ` fill="${C.dim}" font-size="11" font-family="system-ui,sans-serif">${el.id}</text>`;

  return `<g transform="translate(${cx},${cy})">${shape}${label}</g>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a self-contained SVG string auto-fitted to the supplied positions.
 * Returns `null` if no elements have known positions.
 *
 * @param {REElement[]} elements
 * @param {RERelation[]} relations
 * @param {PositionMap}  positions
 * @param {Object}  [opts]
 * @param {boolean} [opts.showWithdrawn=false]
 * @returns {string|null}
 */
export function generateGraphSVG(
  elements,
  relations,
  positions,
  { showWithdrawn = false } = {},
) {
  const visEls = showWithdrawn
    ? elements
    : elements.filter((e) => e.status !== "withdrawn");
  const visIds = new Set(visEls.map((e) => e.id));
  const visRels = relations.filter(
    (r) => visIds.has(r.from) && visIds.has(r.to),
  );
  const byId = Object.fromEntries(elements.map((e) => [e.id, e]));

  const pts = visEls.map((e) => positions[e.id]).filter(Boolean);
  if (!pts.length) return null;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const ox = Math.min(...xs) - PADDING;
  const oy = Math.min(...ys) - PADDING;
  const w = Math.ceil(Math.max(...xs) - ox + PADDING);
  const h = Math.ceil(Math.max(...ys) - oy + PADDING);

  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:${C.bg};border-radius:8px">`,
    `  ${buildDefs()}`,
    ...visRels.map((r) => edgeSVG(r, byId, positions, ox, oy)).filter(Boolean),
    ...visEls.map((el) => nodeSVG(el, positions, ox, oy)).filter(Boolean),
    `</svg>`,
  ];

  return lines.join("\n");
}
