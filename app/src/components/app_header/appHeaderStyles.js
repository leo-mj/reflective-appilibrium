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
  fontFamily: "inherit",
});

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
  fontFamily: "inherit",
  position: "relative",
  zIndex: active ? 1 : 0,
});
