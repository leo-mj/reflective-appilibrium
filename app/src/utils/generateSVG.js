/**
 * @fileoverview Pure SVG string generator for RE graph export.
 * No React dependency — works at export time regardless of which tab is active.
 *
 * Draws what it is given: plain elements as the ids view's nodes, or — from the
 * Graph tab's download button — elements carrying the statement view's `card`
 * as cards, at the positions that view made room for.
 *
 * @module utils/generateSVG
 */

/** @import { REElement, RERelation, PositionMap } from '../types.js' */

import { C, getColors } from "../constants/colors.js";
import { PALETTES, inkWeight } from "../constants/palettes.js";
import {
  arrowGeometry,
  boundaryDistance,
  edgeDashArray,
  elementRadius,
  nodeLabelSize,
} from "./graphHelpers.js";
import { STATEMENT_CARD } from "./statementCards.js";
import {
  GROUP_LABEL_METRICS,
  groupLabelLines,
  projectGroups,
} from "./groupUtils.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDING = 70; // px of whitespace around the bounding box
const M = "x"; // marker-id prefix — avoids collisions if multiple SVGs land in one doc
/**
 * Every relation type an edge can carry, each with an arrowhead of its own.
 * Only the first three used to have one, so an argument's edges — the four
 * inferential types — arrived at their conclusions with no head at all.
 */
const REL_TYPES = [
  "supports",
  "conflicts",
  "undermines",
  "entails",
  "precludes",
  "jointly_entails",
  "jointly_precludes",
];

/**
 * The single-premise inferential types, drawn as on the canvas (`GraphEdge`):
 * a hollow head and a line a pixel heavier, where their joint forms take a
 * filled head. The head is how the two are told apart at a glance.
 */
const HOLLOW = new Set(["entails", "precludes"]);

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

/**
 * Escapes text for an attribute value in double quotes. A font family read off
 * the page quotes its multi-word names — `"SF Mono", Menlo` — and one unescaped
 * `"` ends the attribute and makes the file unparseable.
 */
const escAttr = (t) => esc(t).replace(/"/g, "&quot;");

/** Encodes an SVG string as a base64 data-URL for use in `<img src="...">`. */
export function svgToDataUrl(svg) {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

// ─── <defs> ───────────────────────────────────────────────────────────────────

/**
 * The two theme tokens this SVG references, carried inside it.
 *
 * Node and edge colours are literal hex, but the label colour and the backdrop
 * come from `C.dim` and `C.bg` — and a statement card's from `C.panel` and
 * `C.text` — which are `var(--c-…)` references that only the app's stylesheet
 * defines. An exported file is read somewhere else — an editor,
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
  "svg{--c-dim:#64748b;--c-bg:#f2f3f4;--c-panel:#f1f5f9;--c-text:#0f172a}" +
  "@media(prefers-color-scheme:dark){svg{--c-dim:#94a3b8;--c-bg:#0f172a;--c-panel:#1e293b;--c-text:#e2e8f0}}" +
  "</style>";

function buildDefs(palette) {
  const markers = REL_TYPES.flatMap((t) =>
    [false, true].map((w) => {
      const id = `${M}a-${t}${w ? "-w" : ""}`;
      // Arrowheads take the palette's edge colour, like the lines they cap —
      // an export made in high-contrast mode has to be the graph on screen.
      const color = w ? C.withdrawn : palette.edges[t];
      const op = w ? 0.3 : 1;
      // In user space, so a head is the canvas's 10 × 10px whatever the line's
      // width: sized by the stroke, the heavier single-premise lines got heads
      // half as large again. Anchored at its base (`refX` 0): `arrowGeometry`
      // ends the line 10px short of the target, which is where the head
      // starts, so the tip lands on the border — anchored at the tip, every
      // head stopped a head's length short.
      const paint = HOLLOW.has(t)
        ? `fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"`
        : `fill="${color}"`;
      return (
        `<marker id="${id}" viewBox="-1 -6 12 12" refX="0" refY="0" markerWidth="12" markerHeight="12"` +
        ` markerUnits="userSpaceOnUse" orient="auto">` +
        `<path d="M0,-5L10,0L0,5Z" ${paint} opacity="${op}"/></marker>`
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
  // To the border, whichever shape it is — a statement card's box included.
  const dx = tp.x - sp.x;
  const dy = tp.y - sp.y;
  const { x1, y1, x2, y2 } = arrowGeometry(
    sp,
    tp,
    boundaryDistance(byId[r.from], dx, dy),
    boundaryDistance(byId[r.to], -dx, -dy),
  );
  const color = isW ? C.withdrawn : palette.edges[r.type];
  const op = isW ? 0.25 : 1;
  const dash = edgeDashArray(r.type);
  const marker = `${M}a-${r.type}${isW ? "-w" : ""}`;
  const da = dash !== "none" ? ` stroke-dasharray="${dash}"` : "";
  const width = HOLLOW.has(r.type) ? 3 : 2;
  return (
    `<line x1="${f(x1 - ox)}" y1="${f(y1 - oy)}" x2="${f(x2 - ox)}" y2="${f(y2 - oy)}"` +
    ` stroke="${color}" stroke-width="${width}" opacity="${op}"${da} marker-end="url(#${marker})"/>`
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

/**
 * The merged-process pill the canvas pins to a node (`ProcessTag`), in the
 * colours an export can carry: `C.bg` and `C.dim` are restated in THEME_STYLE,
 * and `C.withdrawn` is a literal — the canvas's `C.panel` and `C.text` are
 * variables nothing outside the app defines.
 */
function processTagSVG(tag, r, at) {
  const h = 13;
  const w = 7 + tag.length * 6;
  // On a card it sits on the top edge, right-aligned, as `ProcessTag` puts it.
  const x = at ? at.x - w / 2 : r * 0.7;
  const y = at ? at.y : -r * 0.95;
  return (
    `<g transform="translate(${f(x)},${f(y)})">` +
    `<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${w}" height="${h}" rx="${h / 2}"` +
    ` fill="${C.bg}" stroke="${C.withdrawn}" stroke-width="1"/>` +
    `<text dy="0.35em" text-anchor="middle" font-size="9" font-weight="bold"` +
    ` fill="${C.dim}" font-family="system-ui,sans-serif">${esc(tag)}</text></g>`
  );
}

/** An element's shape, centred on the origin — `NodeShape`, as a string. */
function shapeSVG(el, r, fill, stroke) {
  if (el.type === "principle") {
    const rw = f(r * 2.2),
      rh = f(r * 1.5);
    return (
      `<rect x="${f(-rw / 2)}" y="${f(-rh / 2)}" width="${rw}" height="${rh}" rx="8"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
    );
  }
  if (el.type === "theory") {
    return (
      `<polygon points="0,${f(-r)} ${f(r)},0 0,${f(r)} ${f(-r)},0"` +
      ` fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
    );
  }
  return `<circle r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

/**
 * How far a withdrawn or rejected card's badge and outline fade, as the canvas
 * fades them (`graphNodeVisuals`). The wording does not fade: it turns to the
 * secondary text colour, so an element out of play is still readable. The ids
 * view's export leaves nodes opaque and lets `getColors` grey them, as it
 * always has.
 */
const stateOpacity = (el) =>
  el.status === "withdrawn" ? 0.25 : el.status === "rejected" ? 0.35 : 1;

/** A statement card's fill, drawn under the edges as the canvas draws it. */
function cardBackgroundSVG(el, positions, ox, oy) {
  const pos = positions[el.id];
  if (!pos) return "";
  const { hw, hh } = el.card;
  return (
    `<rect x="${f(pos.x - ox - hw)}" y="${f(pos.y - oy - hh)}" width="${f(2 * hw)}"` +
    ` height="${f(2 * hh)}" rx="8" fill="${C.panel}"/>`
  );
}

/**
 * A statement card's outline, badge and wording — over the edges, as on the
 * canvas, with the text haloed in the card's colour so an edge crossing the
 * card stops short of the letters. The badge is the node, id inside, in the
 * palette's ink: the card view's node rather than the ids view's export, which
 * hangs the id underneath.
 */
function cardSVG(el, positions, ox, oy, palette, processTag, fontFamily) {
  const pos = positions[el.id];
  if (!pos) return "";
  const { card } = el;
  const { fill, stroke } = getColors(el, palette);
  const r = elementRadius(el);
  const { fontSize, lineHeight } = STATEMENT_CARD;
  const font = ` font-family="${escAttr(fontFamily)}"`;
  const fade = stateOpacity(el);
  const struck = fade < 1 ? ` text-decoration="line-through"` : "";

  const outline =
    `<rect x="${f(-card.hw)}" y="${f(-card.hh)}" width="${f(2 * card.hw)}"` +
    ` height="${f(2 * card.hh)}" rx="8" fill="none" stroke="${stroke}" stroke-width="1.5"` +
    ` stroke-opacity="${fade}"/>`;
  const badge =
    `<g transform="translate(${f(card.badgeX)},${f(card.badgeY ?? 0)})" opacity="${fade}">` +
    shapeSVG(el, r, fill, stroke) +
    `<text dy="0.35em" text-anchor="middle" fill="${palette.ink}"` +
    ` font-size="${nodeLabelSize(el.type)}" font-weight="${inkWeight(palette.ink)}"${font}${struck}>` +
    `${esc(el.id)}</text></g>`;
  const wording =
    `<text font-size="${fontSize}" fill="${fade < 1 ? C.dim : C.text}" stroke="${C.panel}" stroke-width="4"` +
    ` stroke-linejoin="round" paint-order="stroke"${font}>` +
    card.lines
      .map((line, i) => {
        // Held to the width it was measured at. The file names the reader's
        // font, but is read wherever it is sent, and in a font that runs wider
        // the lines ran into the border; narrower, they fell short of it.
        // Glyphs as well as spacing, so a wider font is squeezed rather than
        // made to overlap its own letters.
        const fit = card.widths?.[i]
          ? ` textLength="${f(card.widths[i])}" lengthAdjust="spacingAndGlyphs"`
          : "";
        return `<tspan x="${f(card.textX)}" y="${f(card.textY + i * lineHeight)}"${fit}>${esc(line)}</tspan>`;
      })
      .join("") +
    `</text>`;
  const tag = processTag
    ? processTagSVG(processTag, r, { x: card.hw - 10, y: -card.hh })
    : "";

  return (
    `<g transform="translate(${f(pos.x - ox)},${f(pos.y - oy)})">` +
    outline +
    badge +
    wording +
    tag +
    `</g>`
  );
}

function nodeSVG(el, positions, ox, oy, palette, processTag) {
  const pos = positions[el.id];
  if (!pos) return "";
  // No confidence fade: `getColors` already carries confidence in the fill, and
  // the on-screen graph draws these shapes opaque too.
  const { fill, stroke } = getColors(el, palette);
  const r = elementRadius(el);
  const cx = f(pos.x - ox);
  const cy = f(pos.y - oy);
  const shape = shapeSVG(el, r, fill, stroke);

  const label =
    `<text dy="${r + 14}" text-anchor="middle"` +
    ` fill="${C.dim}" font-size="11" font-family="system-ui,sans-serif">${el.id}</text>`;

  const tag = processTag ? processTagSVG(processTag, r) : "";
  return `<g transform="translate(${cx},${cy})">${shape}${label}${tag}</g>`;
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
 * @param {Map<string, string>} [opts.processTags] - Element id → merged-process
 *   letters (`processTagMap`), drawn on each node as the canvas draws them.
 * @param {string} [opts.fontFamily] - For a statement card's text. The cards
 *   were measured in the reader's font, so the file names it too: wherever that
 *   font is installed, the text fits its box as it did on screen.
 * @returns {string|null}
 */
export function generateGraphSVG(
  elements,
  relations,
  positions,
  {
    showWithdrawn = false,
    palette = PALETTES.default,
    groups = [],
    processTags = new Map(),
    fontFamily = "system-ui,sans-serif",
  } = {},
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
    // A card's half-width, as the canvas pads its groups' hulls.
    radiusOf: (e) => e?.card?.hw ?? elementRadius(e),
  });
  const byId = Object.fromEntries(visEls.map((e) => [e.id, e]));

  const pts = visEls.map((e) => visPositions[e.id]).filter(Boolean);
  if (!pts.length) return null;

  // Hulls stick out past the nodes they surround, and a card far past the
  // padding either side of its centre, so both have to be in the bounding box
  // or they get clipped off.
  const boxes = [
    ...hulls.map((h) => h.box),
    ...visEls
      .filter((e) => e.card && visPositions[e.id])
      .map(({ card, id }) => ({
        x: visPositions[id].x - card.hw,
        y: visPositions[id].y - card.hh,
        w: 2 * card.hw,
        h: 2 * card.hh,
      })),
  ];
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
    // Card fills under the edges, their outlines and text over them.
    ...visEls
      .filter((el) => el.card)
      .map((el) => cardBackgroundSVG(el, visPositions, ox, oy))
      .filter(Boolean),
    ...visRels.map((r) => edgeSVG(r, byId, visPositions, ox, oy, palette)).filter(Boolean),
    ...visEls
      .map((el) =>
        el.type === "group"
          ? groupNodeSVG(el, visPositions, ox, oy)
          : el.card
            ? cardSVG(el, visPositions, ox, oy, palette, processTags.get(el.id), fontFamily)
            : nodeSVG(el, visPositions, ox, oy, palette, processTags.get(el.id)),
      )
      .filter(Boolean),
    `</svg>`,
  ];

  return lines.join("\n");
}
