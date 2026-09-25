/**
 * @fileoverview The graph's statement view: its switch, the cards it draws the
 * elements as, and the positions it draws them at. The geometry lives in
 * `utils/statementCards.js`, the switch in `utils/statementViewSetting.js`
 * (which the Markdown export reads too); this is the wiring.
 *
 * Everything downstream of it — groups, edges, hit-testing, framing — takes the
 * elements and positions it returns and needs to know nothing about the mode.
 * A card is carried on a display copy of an element (`card`), never on state.
 *
 * @module hooks/useStatementView
 */

/** @import { REElement, RERelation, REGroup, PositionMap, Dims } from '../types.js' */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { fitView } from "../utils/graphHelpers.js";
import {
  STATEMENT_CARD,
  STATEMENT_SPREAD,
  cardLayoutInputs,
  nextStatementLayout,
  spreadPositions,
  statementCard,
} from "../utils/statementCards.js";
import {
  setStatementViewOn,
  statementViewOn,
  subscribeStatementView,
} from "../utils/statementViewSetting.js";
import { pageFontFamily, textMeasurer } from "../utils/textWidth.js";

/**
 * The page font, kept current. The font setting writes a custom property onto
 * `<html>` and tells nothing else, so this watches for exactly that.
 *
 * @returns {string}
 */
function usePageFont() {
  const [font, setFont] = useState(pageFontFamily);
  useEffect(() => {
    const observer = new MutationObserver(() => setFont(pageFontFamily()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
    return () => observer.disconnect();
  }, []);
  return font;
}

/** How long the switch between views takes to glide, in ms. */
const MOTION_MS = 320;

/** Ease in and out, so the glide neither starts nor lands with a jolt. */
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Zoomed out past this, a card shows its badge and one line; zoomed back in
 * past the second, all of them again. At 30% a card's 14px text is about 4px
 * on screen — unreadable, and four lines of it only cover the canvas — and the
 * gap between the two is so that a zoom resting near one does not flicker.
 *
 * Not higher: the view opens at whatever zoom fits the graph, which for a
 * process of a few dozen elements is around 45%, and a threshold there — where
 * this started — put the graph's opening view on one line a card, at a size
 * that is small but still read.
 */
const COMPACT_BELOW = 0.3;
const COMPACT_ABOVE = 0.36;

/** Whether the reader has asked their system for less motion. */
const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Positions part of the way from `from` to `to`. Anything `from` did not hold
 * — an element added mid-glide — is simply at its destination.
 *
 * @param {PositionMap} from
 * @param {PositionMap} to
 * @param {number} t - 0 is `from`, 1 is `to`.
 * @returns {PositionMap}
 */
function between(from, to, t) {
  const out = {};
  for (const [id, p] of Object.entries(to)) {
    const q = from[id];
    out[id] = q ? { ...p, x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t) } : p;
  }
  return out;
}

/**
 * @param {Object}       args
 * @param {PositionMap}  args.layoutPositions - The shared simulation's positions.
 * @param {REElement[]}  args.visibleEls - What the canvas draws, before groups.
 * @param {RERelation[]} args.visRels
 * @param {REGroup[]}    args.groups
 * @param {Dims}         args.dims - The canvas, for re-framing on a switch.
 * @param {function}     args.resetView - From `usePan`.
 * @param {{ x: number, y: number }} args.pan - From `usePan`: where a switch glides from.
 * @param {number}       args.zoom - Likewise.
 * @param {function(REElement, (function(string): number)|null): { hw: number, hh: number }} [args.layoutCardOf]
 *   The box to lay each element out at, where that is not the card it is drawn
 *   as — the History tab's, whose cards change with the round played and whose
 *   layout must not (`widestCard`). Defaults to the drawn card.
 * @returns {{ statements: boolean, toggleStatements: function(): void,
 *   drawnEls: REElement[], positions: PositionMap,
 *   measure: (function(string): number)|null }} `measure` is what the cards
 *   were sized with, for anything that sizes one of them again.
 */
export function useStatementView({
  layoutPositions,
  visibleEls,
  visRels,
  groups,
  dims,
  resetView,
  pan,
  zoom,
  layoutCardOf,
}) {
  const statements = useSyncExternalStore(
    subscribeStatementView,
    statementViewOn,
    statementViewOn,
  );
  // What the canvas last drew, and where the view stood: a switch glides from
  // here. Kept at the moment of the press rather than in the effect that runs
  // after it, by which time the new view's positions are already the answer.
  const shown = useRef(null);
  const departure = useRef(null);
  const toggleStatements = () => {
    departure.current = { positions: shown.current, pan, zoom };
    setStatementViewOn(!statementViewOn());
  };

  // Cards are sized in the font their text will be drawn in, so a change of
  // font is a change of every card.
  const font = usePageFont();
  const measure = useMemo(
    () => textMeasurer(`${STATEMENT_CARD.fontSize}px ${font}`),
    [font],
  );
  const cardedEls = statements
    ? visibleEls.map((e) => ({ ...e, card: statementCard(e, { measure }) }))
    : visibleEls;

  // Zoomed far out, cards are drawn one line deep — but laid out full size, so
  // that zooming never rearranges the graph under the reader: the compact
  // cards simply stand further apart. Set during render, as `useCoarseDims`
  // does, so no frame is ever drawn on the side of the threshold just left.
  const [compact, setCompact] = useState(false);
  if (!compact && zoom < COMPACT_BELOW) setCompact(true);
  else if (compact && zoom > COMPACT_ABOVE) setCompact(false);
  const drawnEls =
    statements && compact
      ? cardedEls.map((e) => ({
          ...e,
          card: statementCard(e, {
            measure,
            maxLines: STATEMENT_CARD.compactMaxLines,
          }),
        }))
      : cardedEls;

  // What the layout makes room for: each element's box. Keyed on those boxes,
  // and on which cards an edge joins, rather than on the elements and
  // relations themselves, which are fresh every render — and rather than on
  // the wording, which in the History tab changes with the round while the
  // boxes laid out for it do not.
  const layoutEls = statements
    ? cardedEls.map((e) => ({
        id: e.id,
        card: layoutCardOf ? layoutCardOf(e, measure) : e.card,
      }))
    : [];
  const cardKey = statements
    ? layoutEls
        .map((e) => `${e.id}:${e.card.hw.toFixed(1)}:${e.card.hh.toFixed(1)}`)
        .join(",") +
      "\u0002" +
      visRels.map((r) => `${r.from}>${r.to}`).join(",") +
      "\u0004" +
      groups
        .filter((g) => g.collapsed)
        .map((g) => g.members.join(","))
        .join("|")
    : "";

  // Each tick's pass builds on the last one — see `nextStatementLayout` for why
  // running it afresh on every tick of the simulation jiggles.
  const layout = useRef(null);
  const positions = useMemo(() => {
    if (!statements) {
      layout.current = null;
      return layoutPositions;
    }
    const { footprints, linked } = cardLayoutInputs(layoutEls, visRels, groups);
    layout.current = nextStatementLayout(
      layout.current,
      spreadPositions(layoutPositions, STATEMENT_SPREAD),
      footprints,
      cardKey,
      linked,
    );
    return layout.current.output;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statements, layoutPositions, cardKey]);

  // Switching views re-frames the whole graph, once the positions for the new
  // view exist: the spread one runs well off a canvas fitted to the compact one.
  //
  // It glides there rather than jumping — every element from where it stood to
  // where it is going, and the view with them — so the reader can follow each
  // node to its card and back instead of finding them all again. The shapes
  // change at once; it is the places that move. Not for a reader whose system
  // asks for less motion, nor for a switch not made from the button, which
  // leaves nothing to glide from.
  const [glide, setGlide] = useState(null);
  const framed = useRef(statements);
  useEffect(() => {
    if (framed.current === statements) return;
    framed.current = statements;
    const view = fitView(positions, null, dims, { padding: 96, maxZoom: 1 });
    const from = departure.current;
    departure.current = null;
    if (!view) return;
    if (!from?.positions || reducedMotion()) {
      setGlide(null);
      resetView(view.pan, view.zoom);
      return;
    }
    let frame;
    const start = performance.now();
    const step = (now) => {
      // Clamped below too: a frame's timestamp is when the frame began, which
      // can fall just before `start`, and eased backwards is a twitch.
      const t = Math.min(1, Math.max(0, (now - start) / MOTION_MS));
      const e = ease(t);
      resetView(
        { x: lerp(from.pan.x, view.pan.x, e), y: lerp(from.pan.y, view.pan.y, e) },
        lerp(from.zoom, view.zoom, e),
      );
      setGlide(t < 1 ? { from: from.positions, t: e } : null);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setGlide({ from: from.positions, t: 0 });
    frame = requestAnimationFrame(step);
    // Switched again mid-glide: that one starts from wherever this one got to.
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statements]);

  const drawn = glide ? between(glide.from, positions, glide.t) : positions;
  useEffect(() => {
    shown.current = drawn;
  });

  return { statements, toggleStatements, drawnEls, positions: drawn, measure };
}
