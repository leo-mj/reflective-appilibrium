/**
 * @fileoverview The statement view's card: the node as a badge beside its wording, and the fill drawn under the edges.
 *
 * One of the drawing components gathered in `GraphElements.jsx`, which both
 * graph tabs import from.
 *
 * @module components/graphs_shared/StatementCard
 */

/** @import { REElement } from '../../types.js' */

import { C } from "../../constants/colors.js";
import { STATEMENT_CARD } from "../../utils/statementCards.js";

/**
 * An element as the statement view draws it: a box outlined in the node's own
 * colour, the node itself as a badge at its left, the wording beside it. The
 * geometry is `statementCard` in `utils/statementCards.js`, which edges and the
 * layout read too. The node's opacity, inherited from the group it sits in, is
 * what a selection elsewhere dims it by.
 *
 * A withdrawn or rejected card (`fade` below 1) fades its badge and outline,
 * which keep the state's grey or rose and the struck-through id — striking
 * four lines of wording too would only make them harder to read — and writes
 * its wording in the secondary text colour at full strength: out of play, and
 * still readable. Its background stays opaque, so nothing shows through the
 * text either.
 *
 * @param {{ card: import('../../utils/statementCards.js').StatementCard,
 *   stroke: string, fade?: number, children: React.ReactNode }} props
 */
export function StatementCard({ card, stroke, fade = 1, search = "", children }) {
  const { fontSize, lineHeight } = STATEMENT_CARD;
  return (
    <g
      data-testid={card.expanded ? "statement-card-expanded" : "statement-card"}
    >
      {/* Outline only: the fill is `CardBackground`, drawn under the edges —
          except on an expanded card, which lies over everything, edges and
          neighbouring cards included, and has to cover them. */}
      <rect
        x={-card.hw}
        y={-card.hh}
        width={2 * card.hw}
        height={2 * card.hh}
        rx={8}
        fill={card.expanded ? C.panel : "none"}
        stroke={stroke}
        // The stroke only: on a grown card this rect is the fill as well.
        strokeOpacity={fade}
        // Heavier under the pointer, grown or not — see `hovered` in `Graph`.
        strokeWidth={card.hovered ? 2.5 : 1.5}
        // The whole box is the hover target, fill or no fill. SVG hit-tests an
        // unfilled shape on its stroke alone, and the text takes no pointer
        // events, so without this only the border and the badge reacted — and
        // most hovers, landing on the wording, grew nothing.
        pointerEvents="all"
      />
      <g
        transform={`translate(${card.badgeX},${card.badgeY ?? 0})`}
        opacity={fade}
      >
        {children}
      </g>
      <text
        fontSize={fontSize}
        fill={fade < 1 ? C.dim : C.text}
        // A halo in the card's own colour: an edge crossing the card shows up
        // to the letters and stops short of cutting through them.
        stroke={C.panel}
        strokeWidth={4}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ pointerEvents: "none" }}
      >
        {card.lines.map((line, i) => (
          <tspan key={i} x={card.textX} y={card.textY + i * lineHeight}>
            <SearchMarks text={line} query={search} />
          </tspan>
        ))}
      </text>
    </g>
  );
}

/**
 * A line of card text with what the text panel's search found in it marked —
 * the SVG counterpart of the panel's `Highlight`. Underlined and in the teal
 * foreground tone the panel's mark is tinted with, not bolded: a card is sized
 * to its text's measured width, and bold runs wider.
 *
 * @param {{ text: string, query: string }} props
 */
function SearchMarks({ text, query }) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <tspan
        key={i}
        data-testid="search-mark"
        fill={C.supportsText}
        textDecoration="underline"
      >
        {part}
      </tspan>
    ) : (
      part
    ),
  );
}

/**
 * A statement card's fill, drawn in a layer of its own *under* the edges, with
 * the card's outline and contents over them.
 *
 * An opaque card over the edges hid every edge that ran behind it, and there
 * was no way to tell where one went; a translucent one only half-hid them.
 * This way an edge crossing a card is drawn in full up to the text, whose halo
 * keeps it legible, and the card still reads as a card because its background
 * separates it from the canvas.
 *
 * @param {{ card: import('../../utils/statementCards.js').StatementCard,
 *   position: { x: number, y: number }, opacity: number, transition?: string }} props
 *   `opacity` is the node's, so a card a selection dims fades as a whole. A
 *   withdrawn one does not: its background stays opaque behind its wording.
 */
export function CardBackground({ card, position, opacity, transition }) {
  return (
    <rect
      x={position.x - card.hw}
      y={position.y - card.hh}
      width={2 * card.hw}
      height={2 * card.hh}
      rx={8}
      fill={C.panel}
      style={{ opacity, transition, pointerEvents: "none" }}
    />
  );
}

/**
 * Every card's fill, for a canvas's worth of elements — the layer the edges are
 * drawn over. Shared by the Graph and History tabs, which differ only in how a
 * card fades (`visualsOf`: the selection's dimming on one, the playback's on
 * the other).
 *
 * A grown card is left out: it fills itself, lying over its neighbours as
 * well as over the edges.
 *
 * @param {{ elements: REElement[], positions: Object,
 *   visualsOf: function(REElement): { opacity: number, transition?: string } }} props
 */
export function CardBackgrounds({ elements, positions, visualsOf }) {
  return elements.map((el) => {
    const position = positions[el.id];
    if (!el.card || el.card.expanded || !position) return null;
    const { opacity, transition } = visualsOf(el);
    return (
      <CardBackground
        key={el.id}
        card={el.card}
        position={position}
        opacity={opacity}
        transition={transition}
      />
    );
  });
}
