/**
 * @fileoverview The graph's statement view: each element drawn as a card — its
 * node as a badge beside its wording — with the layout spread out and pushed
 * apart to make room for the cards. The view itself is
 * `hooks/useStatementView.js`; this module is its geometry.
 *
 * **A card, not a node with a label.** Two objects per element was the mess the
 * first version made. The badge is the node at its usual size — shape for type,
 * size and fill for confidence — so nothing the node said is lost, and there is
 * one box per element for the eye and for the layout. A statement does not fit
 * *inside* a node at any readable size, which is why the badge sits beside it.
 * Edges meet a card at its border through `boundaryDistance` in
 * `utils/graphHelpers.js`, and clicks land on it through `hitsElement`.
 *
 * **Measured before it is drawn.** Edges have to know where a card's border is
 * before anything is laid out, so the text is measured off-screen in the font it
 * will inherit (`utils/textWidth.js`), and wrapped by that width rather than by
 * a character count. An estimate at monospace widths sized it at first, and the
 * canvas's own monospace ran wider, so the last characters sat on the border.
 * The estimate is left only where nothing can measure — jsdom, in the tests.
 *
 * **The room comes from the settled layout, not a new one.** Positions are
 * spread about their centroid ({@link spreadPositions}), then only the cards
 * that overlap are pushed apart ({@link separateFootprints}), so the arrangement
 * the reader knows survives the switch in both directions. Plain relaxation
 * rather than a d3 simulation: there is nothing to animate, and an answer that
 * depends only on its input is one the tests can pin.
 *
 * @module utils/statementCards
 */

/** @import { REElement, PositionMap } from '../types.js' */

import { elementRadius } from "./graphHelpers.js";
import { historyOf } from "./stateUtils.js";
import { wrapWords } from "./wrapWords.js";

/** Metrics for a statement card, in simulation coordinates. */
export const STATEMENT_CARD = {
  fontSize: 14,
  lineHeight: 17,
  /** How long a line may run, in characters of the estimate — also the width
   * in px, `maxChars × fontSize × charWidth`, measured lines are held to. */
  maxChars: 26,
  /** Past this the tail is ellipsised, until the card is hovered — see
   * {@link expandedCard}. */
  maxLines: 4,
  /** What a card shows zoomed far out, where its text is too small to read
   * and more lines of it would only cover the canvas. */
  compactMaxLines: 1,
  /** What a hovered card grows to. A statement longer than this is an essay, and
   * the hover card and the text panel still carry all of it. */
  fullMaxLines: 30,
  /** Between the badge and the text. */
  gap: 8,
  /** Inside the card, around its contents. */
  padX: 10,
  padY: 8,
  /** Advance width as a fraction of the font size, for the estimate used where
   * nothing can measure. */
  charWidth: 0.6,
};

/**
 * How far the positions are spread in the statement view. The simulation keeps
 * nodes ~110px apart along a link and as close as `r + 12` otherwise, which is
 * enough for ids and not for a 250px card.
 *
 * Every bit of spread is paid for in zoom: the view is fitted to the spread
 * graph, so doubling it halves what everything measures on screen. Kept modest,
 * since {@link separateFootprints} makes room where cards actually collide,
 * which a uniform spread cannot do however large it is.
 */
export const STATEMENT_SPREAD = 1.5;

/**
 * How wide a line of card text is, in px: measured when `measure` is given
 * (see `utils/textWidth.js`), estimated at monospace widths when it is not.
 *
 * @param {(function(string): number)|null} [measure]
 * @returns {function(string): number}
 */
function lineWidth(measure) {
  const { fontSize, charWidth } = STATEMENT_CARD;
  return measure ?? ((s) => s.length * fontSize * charWidth);
}

/** The widest a line of card text may run, in px. */
const MAX_LINE_WIDTH =
  STATEMENT_CARD.maxChars * STATEMENT_CARD.fontSize * STATEMENT_CARD.charWidth;

/**
 * An element's wording, wrapped for its card.
 *
 * @param {string} text
 * @param {number} [maxLines]
 * @param {(function(string): number)|null} [measure] - Wraps by rendered width.
 * @returns {string[]}
 */
export function statementLines(text, maxLines = STATEMENT_CARD.maxLines, measure) {
  return wrapWords(text, MAX_LINE_WIDTH, maxLines, lineWidth(measure));
}

/**
 * Positions scaled about their centroid.
 *
 * @param {PositionMap} positions
 * @param {number} factor
 * @returns {PositionMap} `positions` itself when there is nothing to scale.
 */
export function spreadPositions(positions, factor) {
  const entries = Object.entries(positions ?? {});
  if (factor === 1 || !entries.length) return positions;
  const cx = entries.reduce((s, [, p]) => s + p.x, 0) / entries.length;
  const cy = entries.reduce((s, [, p]) => s + p.y, 0) / entries.length;
  return Object.fromEntries(
    entries.map(([id, p]) => [
      id,
      { ...p, x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor },
    ]),
  );
}

/**
 * @typedef {Object} StatementCard - Relative to the card's centre, which is
 *   the element's position.
 * @property {number}   hw      - Half the card's width.
 * @property {number}   hh      - Half its height.
 * @property {number}   badgeX  - Centre of the node badge.
 * @property {number}   badgeY  - Its vertical centre: the card's own, except
 *   on an expanded card, where it stays where the card had it.
 * @property {number}   textX   - Left edge of the text.
 * @property {number}   textY   - First baseline.
 * @property {string[]} lines
 * @property {number[]} widths - Each line's width as measured (or estimated),
 *   for a drawing that cannot count on the font it was measured in: the export.
 * @property {boolean}  [expanded] - Drawn over everything, so filled.
 * @property {boolean}  [hovered] - Under the pointer: drawn with a heavier border.
 */

/**
 * Cards already worked out, by measurer and then by what a card depends on.
 *
 * A card is a function of the element's type, confidence and wording, the line
 * limit and the measurer — and the canvases ask for every element's on every
 * render, which while the layout settles is every tick of it. Measurers are
 * held weakly: one per font, and a new one per export, none of which should
 * outlive being used. Bounded all the same, since wordings come and go.
 *
 * @type {WeakMap<Function, Map<string, StatementCard>>}
 */
const cardsByMeasure = new WeakMap();
/** @type {Map<string, StatementCard>} For the estimate, with no measurer. */
const estimatedCards = new Map();
const CARD_CACHE_LIMIT = 5000;

/**
 * The card an element is drawn as in the statement view: its node at its usual
 * size as a badge on the left, the wording beside it.
 *
 * The same object for the same inputs, and frozen: it is shared by every
 * render and every caller that asks, so nothing may change it in place — a
 * variant is a copy (`{ ...card, hovered: true }`).
 *
 * @param {REElement} el
 * @param {{ maxLines?: number, measure?: (function(string): number)|null }} [opts]
 *   `measure` gives a line's rendered width in px; without it, it is estimated.
 * @returns {StatementCard}
 */
export function statementCard(el, { maxLines, measure } = {}) {
  let cache = estimatedCards;
  if (measure) {
    cache = cardsByMeasure.get(measure);
    if (!cache) cardsByMeasure.set(measure, (cache = new Map()));
  }
  const key = `${el.type}\u0000${el.confidence}\u0000${maxLines ?? ""}\u0000${el.text}`;
  let card = cache.get(key);
  if (!card) {
    if (cache.size >= CARD_CACHE_LIMIT) cache.clear();
    card = buildCard(el, { maxLines, measure });
    Object.freeze(card.lines);
    Object.freeze(card.widths);
    cache.set(key, Object.freeze(card));
  }
  return card;
}

/**
 * Works a card out: see {@link statementCard}, which remembers them.
 *
 * @param {REElement} el
 * @param {{ maxLines?: number, measure?: (function(string): number)|null }} opts
 * @returns {StatementCard}
 */
function buildCard(el, { maxLines, measure }) {
  const { fontSize, lineHeight, gap, padX, padY } = STATEMENT_CARD;
  const r = elementRadius(el);
  // `NodeShape`'s principle is 2.2r wide and 1.5r tall; the rest fit in 2r.
  const badgeHalfW = el.type === "principle" ? 1.1 * r : r;
  const badgeHalfH = el.type === "principle" ? 0.75 * r : r;
  const lines = statementLines(el.text, maxLines, measure);
  const widths = lines.map(lineWidth(measure));
  const textW = Math.max(...widths);
  // Ascent to the last descent, at the 1.25 line box a browser gives the font.
  const textH = (lines.length - 1) * lineHeight + fontSize * 1.25;
  const hw = padX + badgeHalfW + gap / 2 + textW / 2;
  const hh = Math.max(badgeHalfH, textH / 2) + padY;
  const left = -hw + padX;
  return {
    hw,
    hh,
    badgeX: left + badgeHalfW,
    badgeY: 0,
    textX: left + 2 * badgeHalfW + gap,
    // The block is centred on the card; its first baseline sits an ascent down.
    textY: -textH / 2 + fontSize * 0.95,
    lines,
    widths,
  };
}

/**
 * What a hovered card grows into, or `null` when it already shows all of its
 * statement. The card itself grows — `Graph` draws this in its place, not over
 * it: a second card laid over the first doubled every border.
 *
 * Grown from the card's own top-left corner rather than about its centre, with
 * the badge left where it was: the text the reader has been looking at stays
 * in place and the rest of it appears below. Drawn over its neighbours and left
 * out of the layout, so growing one moves no other card — a card that pushed
 * its neighbours aside whenever the pointer crossed it would reshuffle the
 * graph under the reader.
 *
 * @param {REElement} el
 * @param {StatementCard} card - What the element is drawn as otherwise.
 * @param {{ measure?: (function(string): number)|null }} [opts] - As `card`
 *   was measured.
 * @returns {{ card: StatementCard, dx: number, dy: number }|null} The expanded
 *   card, and how far its centre sits from the element's position.
 */
export function expandedCard(el, card, { measure } = {}) {
  const full = statementCard(el, {
    maxLines: STATEMENT_CARD.fullMaxLines,
    measure,
  });
  const same =
    full.lines.length === card.lines.length &&
    full.lines.every((line, i) => line === card.lines[i]);
  if (same) return null;
  const dx = full.hw - card.hw;
  const dy = full.hh - card.hh;
  return {
    card: { ...full, badgeY: -dy, expanded: true },
    dx,
    dy,
  };
}

/**
 * The box an element's card needs at its largest, over every wording it has
 * had — for laying out a graph that plays its history back. Laid out by the
 * wording of the round on screen, the cards would be pushed about afresh each
 * time a statement was revised; laid out by this, the layout holds still
 * through playback and every round's card fits where it stands.
 *
 * @param {REElement} el - As it stands now, history and all.
 * @param {(function(string): number)|null} [measure]
 * @returns {{ hw: number, hh: number }}
 */
export function widestCard(el, measure) {
  const wordings = [
    el.text,
    ...historyOf(el)
      .map((ev) => ev.previousText)
      .filter(Boolean),
  ];
  let hw = 0;
  let hh = 0;
  for (const text of wordings) {
    const card = statementCard({ ...el, text }, { measure });
    hw = Math.max(hw, card.hw);
    hh = Math.max(hh, card.hh);
  }
  return { hw, hh };
}

/**
 * The box a card takes up, in the form {@link separateFootprints} takes.
 *
 * @param {StatementCard} card
 * @returns {{ hw: number, top: number, bottom: number }}
 */
export function cardFootprint(card) {
  return { hw: card.hw, top: -card.hh, bottom: card.hh };
}

/**
 * Positions moved just far enough that no two footprints overlap.
 *
 * Only boxes that collide move, each by a share of the overlap (`PUSH`), along
 * whichever axis needs less — which is what keeps the arrangement the reader knows. Two boxes
 * an edge runs between are held further apart than the rest (`linkedMargin`):
 * edges stop at a card's border, so the gap between two connected cards is all
 * the edge there is, and at the ordinary margin it was mostly arrowhead.
 *
 * @param {PositionMap} positions
 * @param {Map<string, { hw: number, top: number, bottom: number }>} footprints -
 *   Only these ids take part; every other position is handed back as it was.
 * @param {{ margin?: number, linkedMargin?: number, linked?: Set<string>,
 *   iterations?: number, start?: PositionMap }} [opts] -
 *   `linked` holds `"a|b"` for every connected pair, either way round. `start`
 *   is where to begin pushing from instead of `positions`, for a node it holds
 *   — see {@link nextStatementLayout}.
 * @returns {PositionMap}
 */
export function separateFootprints(
  positions,
  footprints,
  { margin = 12, linkedMargin = 44, linked, iterations = 200, start } = {},
) {
  const nodes = [...footprints]
    .filter(([id]) => positions[id])
    .map(([id, f]) => {
      const from = start?.[id] ?? positions[id];
      return { id, f, x: from.x, y: from.y };
    });

  /** Pushes a pair apart if their boxes overlap; says whether it did. */
  const resolve = (i, j) => {
    const a = nodes[i];
    const b = nodes[j];
    const m = linked?.has(`${a.id}|${b.id}`) ? linkedMargin : margin;
    const ox =
      Math.min(a.x + a.f.hw, b.x + b.f.hw) -
      Math.max(a.x - a.f.hw, b.x - b.f.hw) +
      m;
    if (ox <= 0) return false;
    const oy =
      Math.min(a.y + a.f.bottom, b.y + b.f.bottom) -
      Math.max(a.y + a.f.top, b.y + b.f.top) +
      m;
    if (oy <= 0) return false;
    if (ox < oy) {
      // Ties go by order, so two nodes on one spot still come apart.
      const s = a.x < b.x || (a.x === b.x && i < j) ? -1 : 1;
      a.x += s * ox * PUSH;
      b.x -= s * ox * PUSH;
    } else {
      const ay = a.y + (a.f.top + a.f.bottom) / 2;
      const by = b.y + (b.f.top + b.f.bottom) / 2;
      const s = ay < by || (ay === by && i < j) ? -1 : 1;
      a.y += s * oy * PUSH;
      b.y -= s * oy * PUSH;
    }
    return true;
  };

  // Every pair, for a graph small enough that that is nothing. Past it, only
  // the pairs a grid says could touch: the pass is otherwise a square in the
  // number of cards, run on every visible move of a settling layout.
  const pairsOf =
    nodes.length < GRID_FROM ? everyPair(nodes.length) : nearPairs(nodes, {
      margin: Math.max(margin, linked ? linkedMargin : 0),
    });

  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const [i, j] of pairsOf()) if (resolve(i, j)) moved = true;
    if (!moved) break;
  }

  const out = { ...positions };
  for (const n of nodes) out[n.id] = { ...positions[n.id], x: n.x, y: n.y };
  return out;
}

/**
 * What the overlap pass needs from a set of carded elements: each card's box,
 * and which pairs an edge joins. Members of a collapsed group sit out — they
 * are drawn as the group's disc, not as cards.
 *
 * @param {Array<REElement & { card: StatementCard }>} cardedEls
 * @param {import('../types.js').RERelation[]} relations
 * @param {import('../types.js').REGroup[]} groups
 * @returns {{ footprints: Map<string, { hw: number, top: number, bottom: number }>,
 *   linked: Set<string> }}
 */
export function cardLayoutInputs(cardedEls, relations, groups) {
  const collapsed = new Set(
    groups.filter((g) => g.collapsed).flatMap((g) => g.members),
  );
  return {
    footprints: new Map(
      cardedEls
        .filter((e) => !collapsed.has(e.id))
        .map((e) => [e.id, cardFootprint(e.card)]),
    ),
    linked: new Set(
      relations.flatMap((r) => [`${r.from}|${r.to}`, `${r.to}|${r.from}`]),
    ),
  };
}

/**
 * The statement view in one pass, for a picture of it rather than a canvas
 * that moves — the Markdown export's graph. Each element carded, the positions
 * spread and pushed apart as the canvas does it, from scratch: there is no
 * earlier frame to continue from, and nothing moving to jiggle.
 *
 * @param {REElement[]} elements - What the picture shows.
 * @param {import('../types.js').RERelation[]} relations
 * @param {PositionMap} positions - The shared simulation's.
 * @param {import('../types.js').REGroup[]} groups
 * @param {(function(string): number)|null} [measure]
 * @returns {{ elements: Array<REElement & { card: StatementCard }>, positions: PositionMap }}
 */
export function statementGraph(elements, relations, positions, groups, measure) {
  const carded = elements.map((e) => ({ ...e, card: statementCard(e, { measure }) }));
  const { footprints, linked } = cardLayoutInputs(carded, relations, groups);
  return {
    elements: carded,
    positions: separateFootprints(
      spreadPositions(positions, STATEMENT_SPREAD),
      footprints,
      { linked },
    ),
  };
}

/**
 * How far each of an overlapping pair is pushed, as a share of the overlap.
 *
 * Not ½, which parts them exactly: in a chain, parting one pair exactly nudges
 * its neighbours back into contact, and the pass crept rather than settled —
 * 30 cards at the canvas's density still overlapping after its 200 passes,
 * with 1,000 needed to clear them. Parting by half as much again settles the
 * same cards in a few passes and moves them less far overall, at the price of
 * gaps up to half an overlap wider than the margin.
 */
const PUSH = 0.75;

/**
 * From how many cards {@link separateFootprints} compares only neighbours.
 * Below it every pair is compared, as it always was — so a process of the
 * size anyone has yet lays out exactly as before.
 */
const GRID_FROM = 60;

/**
 * Every pair `[i, j]`, `i < j`, of `n` — the same each pass.
 *
 * @param {number} n
 * @returns {function(): Iterable<[number, number]>}
 */
function everyPair(n) {
  return function* () {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) yield [i, j];
  };
}

/**
 * The pairs `[i, j]`, `i < j`, whose boxes could overlap, by a grid built
 * afresh from where the nodes stand at the start of each pass.
 *
 * A cell is as wide and as tall as the most two boxes can overlap by, so any
 * pair that does sits in the same cell or neighbouring ones. Nodes moved
 * during a pass may come to overlap where the grid did not look; the next
 * pass's grid does, and the loop ends only after a pass that found nothing.
 * Within a node's candidates the order is ascending, as {@link everyPair}'s.
 *
 * @param {{ x: number, y: number, f: { hw: number, top: number, bottom: number } }[]} nodes
 * @param {{ margin: number }} opts - The largest margin any pair is held to.
 * @returns {function(): Iterable<[number, number]>}
 */
function nearPairs(nodes, { margin }) {
  const cellW = 2 * Math.max(...nodes.map((n) => n.f.hw)) + margin;
  const cellH =
    Math.max(...nodes.map((n) => n.f.bottom)) -
    Math.min(...nodes.map((n) => n.f.top)) +
    margin;
  return function* () {
    const cells = new Map();
    const at = (n) => [Math.floor(n.x / cellW), Math.floor(n.y / cellH)];
    nodes.forEach((n, i) => {
      const key = at(n).join(",");
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(i);
    });
    for (let i = 0; i < nodes.length; i++) {
      const [cx, cy] = at(nodes[i]);
      const near = [];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const j of cells.get(`${cx + dx},${cy + dy}`) ?? [])
            if (j > i) near.push(j);
      near.sort((a, b) => a - b);
      for (const j of near) yield [i, j];
    }
  };
}

/** Below this, in simulation px, a move of the layout is not passed on. */
const SETTLE_THRESHOLD = 2;

/**
 * @typedef {Object} StatementLayout
 * @property {PositionMap} input  - The positions the pass was last run on.
 * @property {PositionMap} output - What it made of them.
 * @property {string}      key    - Identifies the footprints it used.
 */

/**
 * The statement view's positions for this tick of the layout, given the last.
 *
 * {@link separateFootprints} is not continuous in its input: a sub-pixel shift
 * can tip two boxes from clear to overlapping, or change which way a pair is
 * pushed, and move a node by tens of pixels. The simulation spends many
 * seconds creeping by sub-pixels after it looks still, so running the pass
 * afresh on every tick turned an invisible settle into a long visible jiggle.
 * Two things stop it:
 *
 * - **Moves too small to see are not passed on.** Until some node has moved
 *   {@link SETTLE_THRESHOLD} px since the last run, the last output stands —
 *   the same object, so nothing downstream re-renders for it.
 * - **A run starts from the last output**, each node shifted by however far it
 *   actually moved, so only what now overlaps is pushed and a small move of the
 *   layout is a small move on screen.
 *
 * Warm starts only while the footprints and links are the same: a node pushed
 * aside is never pulled back, so a change of elements, wording or relations
 * starts afresh, which is also the moment the layout itself is moving anyway.
 *
 * @param {StatementLayout|null} prev
 * @param {PositionMap} input - This tick's positions, already spread.
 * @param {Map<string, { hw: number, top: number, bottom: number }>} footprints
 * @param {string} key - Changes whenever `footprints` or `linked` would.
 * @param {Set<string>} [linked] - Connected pairs; see {@link separateFootprints}.
 * @returns {StatementLayout}
 */
export function nextStatementLayout(prev, input, footprints, key, linked) {
  const warm = prev && prev.key === key;
  if (warm) {
    let moved = false;
    for (const id of footprints.keys()) {
      const a = input[id];
      const b = prev.input[id];
      if (!a !== !b) moved = true;
      else if (a && Math.hypot(a.x - b.x, a.y - b.y) > SETTLE_THRESHOLD)
        moved = true;
      if (moved) break;
    }
    if (!moved) return prev;
  }
  const start = warm
    ? Object.fromEntries(
        [...footprints.keys()]
          .filter((id) => input[id] && prev.input[id] && prev.output[id])
          .map((id) => [
            id,
            {
              x: prev.output[id].x + input[id].x - prev.input[id].x,
              y: prev.output[id].y + input[id].y - prev.input[id].y,
            },
          ]),
      )
    : undefined;
  return {
    input,
    output: separateFootprints(input, footprints, { start, linked }),
    key,
  };
}
