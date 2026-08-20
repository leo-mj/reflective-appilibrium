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
 * A card's metadata chips: confidence, origin, round, status.
 *
 * @param {boolean} isWide - Narrow gives them a line of their own. `order` puts
 *   them after the buttons in the visual flow, and a full-width basis makes
 *   them start that line rather than squeeze onto the end of the first.
 */
export const cardChips = (isWide) => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
  ...(isWide ? null : { order: 1, flexBasis: "100%" }),
});

/** A card's action buttons, held against the trailing edge of the first line. */
export const cardActions = { marginLeft: "auto" };

export const META_LABEL_STYLE = {
  fontSize: 12,
  fontStyle: "italic",
  marginTop: 5,
  lineHeight: 1.5,
};

export const CONTENT_FONT_SIZE = 12;

export const CLUSTER_CARD_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  paddingBottom: 3,
  borderBottom: `1px solid ${C.border}`,
};
