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
  padding: "1px 7px",
  lineHeight: 1.8,
};

export const WITHDRAW_BTN_STYLE = {
  ...GHOST_BTN_STYLE,
  background: "#dc262680",
  color: "#fff",
};

export const CARD_STYLE = {
  paddingBottom: 14,
  borderBottom: `1px solid ${C.border}66`,
  marginBottom: 14,
};

export const META_LABEL_STYLE = {
  fontSize: 12,
  fontStyle: "italic",
  marginTop: 5,
  lineHeight: 1.5,
};

export const CONTENT_FONT_SIZE = 14;
