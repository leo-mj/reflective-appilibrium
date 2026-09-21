/**
 * @fileoverview Shared inline-style constants for TextTab and its sub-components.
 * Kept in a plain .js file so React fast-refresh only-export-components rule is satisfied
 * in the .jsx files that import these.
 * @module constants/textTabStyles
 */

import { C } from "./colors.js";

export const GHOST_BTN_STYLE = {
  background: "none",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.dim,
  cursor: "pointer",
  fontSize: 12,
  padding: "4px 9px",
  lineHeight: 1.6,
  // Height is left to the text and padding, which come to about 29. Touchscreens
  // grow it to 36 through the .tap-target class in index.css — a mouse does not
  // need the room, and taking it there made the panel loud.
};

export const WITHDRAW_BTN_STYLE = {
  ...GHOST_BTN_STYLE,
  background: C.danger + "80",
  color: C.onFill,
};

/**
 * A card's action buttons dropped to the metadata chips' type scale — the wide
 * layout only, applied by {@link module:components/text_panel/TextTabPrimitives.ActionButtons}.
 *
 * Wide, the chips and the buttons share one line, and at 12px against the chips'
 * 10px the controls were the loudest thing in a card whose point is the claim
 * underneath them. Narrow keeps the larger text: there the panel is the whole
 * screen and these are the primary way to act on a card.
 *
 * The floor is carried by `minHeight` rather than by the padding alone, so a
 * font with different metrics cannot quietly drop the button under the 24px
 * WCAG 2.2 AA target size. Touch pointers still get 36px from `.tap-target` in
 * index.css, which keys on the pointer rather than the viewport — so a wide
 * screen that is thumbed gets the smaller text and the bigger target both.
 */
export const COMPACT_BTN_STYLE = {
  fontSize: 10,
  padding: "3px 8px",
  minHeight: 24,
};

export const CARD_STYLE = {
  paddingBottom: 14,
  borderBottom: `1px solid ${C.border}`,
  marginBottom: 14,
};

/**
 * The row at the top of a card. Holds three things: what the item is (its id,
 * or for a relation its two ends), the metadata chips, and the action buttons.
 *
 * Wide, all three share a line with the buttons at the trailing edge. Narrow,
 * there is not room, so the chips drop to a line of their own — see
 * {@link cardChips}. What keeps the first line is the id and the buttons: the
 * two things you are looking for when scanning down a list of cards.
 */
export const cardHeader = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
};

/**
 * What the card is about — the id badge, or a relation's from/type/to. Grouped
 * so it wraps as a unit rather than scattering its parts across the lines that
 * the chips and the buttons are using.
 */
export const cardIdentity = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  flexWrap: "wrap",
  minWidth: 0,
};

/**
 * A card's metadata chips: confidence, origin, round, status, the process a
 * merge brought it from, and the scores the simulation adds.
 *
 * Below the content, not in the header row. They kept arriving — a merge adds a
 * process chip, the simulation a withdrawal score apiece — and any row holding
 * both them and the buttons ends up either two lines deep or with the buttons
 * pushed off onto a line of their own. Under the statement they have the whole
 * width to wrap into, and the header stays what it was worth keeping: the id
 * and the two buttons, which is what the eye is looking for down a list of
 * cards. It is also where `ArgumentCard` has always put its own.
 *
 * Both widths, now: the chips no longer compete with anything for the row, so
 * there is nothing left for a narrow screen to do differently.
 */
/**
 * A grid rather than a row, so the fields line up *down* the list as well as
 * across one card. Packed in a row, every field's position depends on the width
 * of the text before it — "Moderate" is wider than "High", so a column of cards
 * had its origins and rounds at a different place on every line. Equal columns
 * of a fixed minimum put each field in the same place in every card, whatever
 * it says.
 *
 * `auto-fill` rather than a fixed count: the panel is dragged to whatever width
 * the reader likes, and the columns are the same in every card at any of them.
 * A value too long for its cell is cut with an ellipsis and keeps its full text
 * in `title` — see {@link module:components/TextTabPrimitives.StatField}.
 *
 * Fields *stretch* to their column, unlike the chips that came before them: a
 * caption over a value is already as narrow as its content looks, and the cell
 * is what the ellipsis needs to measure against. `alignItems: start` because a
 * field whose value wraps — the covered judgments — must not centre itself
 * against the single-line ones beside it.
 */
export const cardStats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
  alignItems: "start",
  columnGap: 10,
  rowGap: 8,
};

/**
 * The rule under a card's claim, with the details control sitting on it. What
 * is above it is the statement; what is below is everything said about it.
 */
export const cardDivider = {
  marginTop: 8,
  paddingTop: 4,
  borderTop: `1px solid ${C.border}`,
};

/**
 * The one chip that stays in a header row: the status of a single premise in an
 * argument card, which belongs to its own line rather than to the card.
 *
 * @param {boolean} isWide - Narrow gives it a line of its own.
 */
export const cardChips = (isWide) => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
  ...(isWide ? null : { order: 1, flexBasis: "100%" }),
});

/**
 * A card's action buttons, held against the trailing edge of the first line.
 *
 * Never shrunk: they are the row's fixed point, and squeezing them is how
 * "Withdraw" comes to wrap mid-word.
 */
export const cardActions = { marginLeft: "auto", flexShrink: 0 };

export const META_LABEL_STYLE = {
  fontSize: 11,
  fontStyle: "italic",
  marginTop: 5,
  lineHeight: 1.5,
};

/**
 * The claim itself — an element's statement, a relation's explanation, the
 * premises spelled out under an argument. A notch under the chrome around it
 * (headers at 12, chips at 10) so that a panel showing two dozen cards fits
 * more of them on screen without the text dropping to chip size.
 */
export const CONTENT_FONT_SIZE = 11;

export const CLUSTER_CARD_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  // A cluster member is an element's statement, so it takes the same size the
  // element's own card gives it.
  fontSize: CONTENT_FONT_SIZE,
  paddingBottom: 3,
  borderBottom: `1px solid ${C.border}`,
};
