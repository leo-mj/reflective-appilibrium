/**
 * @fileoverview Shared button style helpers for AppHeader layouts.
 * @module components/app_header/appHeaderStyles
 */

import { C } from "../../constants/colors.js";

/** Standard icon/action button style. */
export const btn = (active) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  height: 36,
  padding: "0 12px",
  boxSizing: "border-box",
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  fontSize: 12,
  background: active ? C.border : "transparent",
  color: active ? C.text : C.dim,
});

/** Shared icon span style used in both header menu layouts. */
export const menuIconStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  flexShrink: 0,
};

/** Horizontal rule between menu sections. Render as <div style={menuDividerStyle} />. */
export const menuDividerStyle = { height: 1, background: C.border, margin: "2px 0" };

/**
 * One labelled block of the ☰ menu. Both layouts group the same rows under the
 * same headings, in the same order — Content, Model, Appearance, Text panel,
 * Session — so that what a setting reaches is legible from where it sits: the
 * two that change what the app works with are at the top, the two that dress a
 * single panel are near the bottom.
 *
 * A block is one element so the tour can ring a whole section rather than pick
 * out single rows.
 */
export const menuGroupStyle = { display: "flex", flexDirection: "column", gap: 2 };

/** Heading over a {@link menuGroupStyle} block. */
export const menuHeadingStyle = {
  fontSize: 10,
  color: C.dim,
  fontWeight: "bold",
  padding: "4px 4px 2px",
  letterSpacing: "0.05em",
};

/** Vertical divider between inline toolbar buttons. Render as <div style={inlineDividerStyle} />. */
export const inlineDividerStyle = {
  width: 1,
  height: 20,
  background: C.border,
  alignSelf: "center",
  margin: "0 4px",
};

/** Connected-tab style for Analyze / Assist meta-tab buttons (wide layout). */
export const metaTabBtn = (active) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 30,
  padding: "0 14px",
  boxSizing: "border-box",
  borderRadius: "4px 4px 0 0",
  border: `1px solid ${C.border}`,
  borderBottom: `1px solid ${active ? C.bg : C.border}`,
  marginBottom: active ? -1 : 0,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: active ? "600" : "normal",
  background: active ? C.border : "transparent",
  color: active ? C.text : C.dim,
  position: "relative",
  zIndex: active ? 1 : 0,
});
