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
import { useViewGlide } from "./useViewGlide.js";

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

  // Switching views re-frames the whole graph, gliding there: see
  // `hooks/useViewGlide.js`. The departure is marked at the press.
  const { drawn, depart } = useViewGlide({
    trigger: statements,
    positions,
    dims,
    resetView,
    pan,
    zoom,
  });
  const toggleStatements = () => {
    depart();
    setStatementViewOn(!statementViewOn());
  };

  return { statements, toggleStatements, drawnEls, positions: drawn, measure };
}
