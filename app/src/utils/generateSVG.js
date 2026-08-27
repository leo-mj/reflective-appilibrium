/**
 * @fileoverview Pure SVG string generator for RE graph export.
 * No React or DOM dependency — works at export time regardless of which tab is active.
 * @module utils/generateSVG
 */

/** @import { REElement, RERelation, PositionMap } from '../types.js' */

import { C, getColors } from "../constants/colors.js";
import { PALETTES } from "../constants/palettes.js";
import { elementRadius, arrowGeometry, edgeDashArray } from "./graphHelpers.js";
import {
  GROUP_LABEL_METRICS,
  groupLabelLines,
  projectGroups,
} from "./groupUtils.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = 70; // px of whitespace around the bounding box
const M = "x"; // marker-id prefix — avoids collisions if multiple SVGs land in one doc
const REL_TYPES = ["supports", "conflicts", "undermines", "depends"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rounds a float to 1 decimal place for compact SVG attributes. */
const f = (n) => +n.toFixed(1);

/**
 * Escapes text for an SVG text node.
 *
 * Element ids match `[JPT]\d+` and never needed this, but a group's name is
 * whatever the user typed, and an unescaped `&` or `<` is enough to make the
 * whole file unparseable.
 */
const esc = (t) =>
  String(t).replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );

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

function buildDefs(palette) {
  const markers = REL_TYPES.flatMap((t) =>
    [false, true].map((w) => {
      const id = `${M}a-${t}${w ? "-w" : ""}`;
      // Arrowheads take the palette's edge colour, like the lines they cap —
      // an export made in high-contrast mode has to be the graph on screen.
      const color = w ? C.withdrawn : palette.edges[t];
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

function edgeSVG(r, byId, positions, ox, oy, palette) {
  const sp = positions[r.from];
  const tp = positions[r.to];
  if (!sp || !tp) return "";
  const isW = r.status === "withdrawn";
  const { x1, y1, x2, y2 } = arrowGeometry(
    sp,
    tp,
    elementRadius(byId[r.from]),
    elementRadius(byId[r.to]),
  );
  const color = isW ? C.withdrawn : palette.edges[r.type];
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

/** The dashed box an expanded group is drawn in, plus its name. */
function hullSVG({ group, box }, ox, oy) {
  return (
    `<g><rect x="${f(box.x - ox)}" y="${f(box.y - oy)}" width="${f(box.w)}" height="${f(box.h)}"` +
    ` rx="18" fill="${C.withdrawn}" fill-opacity="0.06" stroke="${C.withdrawn}"` +
    ` stroke-width="1.5" stroke-dasharray="7 5"/>` +
    `<text x="${f(box.x - ox + 14)}" y="${f(box.y - oy + 18)}" font-size="12"` +
    ` fill="${C.withdrawn}" font-family="system-ui,sans-serif">${esc(group.label)}</text></g>`
  );
}

/**
 * A collapsed group, as the double-ringed disc the canvas draws.
 *
 * One light outline. It used to be two concentric rings, which is the shape the
 * selected-node ring already has on screen.
 *
 * Literal `C.withdrawn` grey rather than the `var(--c-dim)` the app uses: an
 * export is read outside the app, where that variable resolves to nothing. The
 * two happen to be the same slate — see the THEME_STYLE note above, which
 * carries the tokens the labels do need.
 */
function groupNodeSVG(el, positions, ox, oy) {
  const pos = positions[el.id];
  if (!pos) return "";
  const r = elementRadius(el);
  const cx = f(pos.x - ox);
  const cy = f(pos.y - oy);
  const n = el.memberIds.length;

  const lines = groupLabelLines(el.label);
  const { fontSize, lineHeight, countLineHeight } = GROUP_LABEL_METRICS;
  const top = -(lines.length * lineHeight + countLineHeight) / 2 + fontSize;
  const label = lines
    .map(
      (line, i) =>
        `<text y="${f(top + i * lineHeight)}" text-anchor="middle" font-size="${fontSize}"` +
        ` font-weight="bold" fill="${C.dim}" font-family="system-ui,sans-serif">${esc(line)}</text>`,
    )
    .join("");

  return (
    `<g transform="translate(${cx},${cy})">` +
    `<circle r="${f(r)}" fill="${C.bg}" stroke="${C.withdrawn}" stroke-width="1.5"/>` +
    label +
    `<text y="${f(top + lines.length * lineHeight + 2)}" text-anchor="middle" font-size="9"` +
    ` fill="${C.dim}" font-family="system-ui,sans-serif">${n} ${n === 1 ? "element" : "elements"}</text>` +
    `</g>`
  );
}

function nodeSVG(el, positions, ox, oy, palette) {
  const pos = positions[el.id];
  if (!pos) return "";
  // No confidence fade: `getColors` already carries confidence in the fill, and
  // the on-screen graph draws these shapes opaque too.
  const { fill, stroke } = getColors(el, palette);
  const r = elementRadius(el);
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
 * @param {import('../types.js').REGroup[]} [opts.groups=[]] - Drawn exactly as
 *   the canvas draws them, so a downloaded graph is the graph that was on
 *   screen: collapsed groups as one node, expanded ones inside a dashed hull.
 * @param {import('../constants/palettes.js').Palette} [opts.palette] - Defaults
 *   to the standard palette. An export is read in a document rather than in the
 *   app, so it does not follow a reader's high-contrast setting unless asked to.
 * @returns {string|null}
 */
export function generateGraphSVG(
  elements,
  relations,
  positions,
  { showWithdrawn = false, palette = PALETTES.default, groups = [] } = {},
) {
  const shownEls = showWithdrawn
    ? elements
    : elements.filter((e) => e.status !== "withdrawn");
  const shownIds = new Set(shownEls.map((e) => e.id));
  const shownRels = relations.filter(
    (r) => shownIds.has(r.from) && shownIds.has(r.to),
  );

  const {
    elements: visEls,
    relations: visRels,
    positions: visPositions,
    hulls,
  } = projectGroups({
    elements: shownEls,
    relations: shownRels,
    groups,
    positions,
    radiusOf: elementRadius,
  });
  const byId = Object.fromEntries(visEls.map((e) => [e.id, e]));

  const pts = visEls.map((e) => visPositions[e.id]).filter(Boolean);
  if (!pts.length) return null;

  // Hulls stick out past the nodes they surround, so they have to be in the
  // bounding box or an expanded group gets its outline clipped off.
  const boxes = hulls.map((h) => h.box);
  const xs = [
    ...pts.map((p) => p.x),
    ...boxes.flatMap((b) => [b.x, b.x + b.w]),
  ];
  const ys = [
    ...pts.map((p) => p.y),
    ...boxes.flatMap((b) => [b.y, b.y + b.h]),
  ];
  const ox = Math.min(...xs) - PADDING;
  const oy = Math.min(...ys) - PADDING;
  const w = Math.ceil(Math.max(...xs) - ox + PADDING);
  const h = Math.ceil(Math.max(...ys) - oy + PADDING);

  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:${C.bg};border-radius:8px">`,
    `  ${buildDefs(palette)}`,
    ...hulls.map((hull) => hullSVG(hull, ox, oy)),
    ...visRels.map((r) => edgeSVG(r, byId, visPositions, ox, oy, palette)).filter(Boolean),
    ...visEls
      .map((el) =>
        el.type === "group"
          ? groupNodeSVG(el, visPositions, ox, oy)
          : nodeSVG(el, visPositions, ox, oy, palette),
      )
      .filter(Boolean),
    `</svg>`,
  ];

  return lines.join("\n");
}
