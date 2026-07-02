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
