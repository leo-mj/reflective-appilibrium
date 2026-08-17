/**
 * @fileoverview Pure SVG string generator for RE graph export.
 * No React or DOM dependency — works at export time regardless of which tab is active.
 * @module utils/generateSVG
 */

/** @import { REElement, RERelation, PositionMap } from '../types.js' */

import { C, getColors } from "../constants/colors.js";
import { PALETTES } from "../constants/palettes.js";
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

/**
 * The two theme tokens this SVG references, carried inside it.
 *
 * Node and edge colours are literal hex, but the label colour and the backdrop
 * come from `C.dim` and `C.bg`, which are `var(--c-…)` references that only the
 * app's stylesheet defines. An exported file is read somewhere else — an editor,
 * a browser, a markdown viewer — where neither resolves: labels fall back to
 * black and the backdrop to transparent, which on a dark viewer means invisible
 * labels. Restating them here keeps the export self-contained.
 *
 * Both schemes are declared rather than freezing in whichever theme happened to
 * be on at export time, so the file suits whoever opens it. Light is the
 * default because a viewer that expresses no preference is usually light.
 */
const THEME_STYLE =
  "<style>" +
  "svg{--c-dim:#64748b;--c-bg:#f2f3f4}" +
  "@media(prefers-color-scheme:dark){svg{--c-dim:#94a3b8;--c-bg:#0f172a}}" +
  "</style>";

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
  return `<defs>${THEME_STYLE}${markers.join("")}</defs>`;
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

function nodeSVG(el, positions, ox, oy, palette) {
  const pos = positions[el.id];
  if (!pos) return "";
  // No confidence fade: `getColors` already carries confidence in the fill, and
  // the on-screen graph draws these shapes opaque too.
  const { fill, stroke } = getColors(el, palette);
  const r = nodeRadius(el.type, el.confidence);
  const cx = f(pos.x - ox);
  const cy = f(pos.y - oy);

  let shape;
  if (el.type === "principle") {
    const rw = f(r * 2.2),
      rh = f(r * 1.5);
    shape =
      `<rect x="${f(-rw / 2)}" y="${f(-rh / 2)}" width="${rw}" height="${rh}" rx="8"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  } else if (el.type === "theory") {
    shape =
      `<polygon points="0,${f(-r)} ${r},0 0,${r} ${f(-r)},0"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  } else {
    shape = `<circle r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
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
 * @param {import('../constants/palettes.js').Palette} [opts.palette] - Defaults
 *   to the standard palette. An export is read in a document rather than in the
 *   app, so it does not follow a reader's high-contrast setting unless asked to.
 * @returns {string|null}
 */
export function generateGraphSVG(
  elements,
  relations,
  positions,
  { showWithdrawn = false, palette = PALETTES.default } = {},
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
    ...visEls.map((el) => nodeSVG(el, positions, ox, oy, palette)).filter(Boolean),
    `</svg>`,
  ];

  return lines.join("\n");
}
