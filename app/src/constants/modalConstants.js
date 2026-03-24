import { C } from "./colors.js";
// ─── Shared form styles (exported for use in modal form fields) ───────────────

/** Input / select / textarea style shared across all modals. */
export const INPUT_STYLE = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.text,
  padding: "6px 10px",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

/** Label style shared across all modals. */
export const LABEL_STYLE = {
  fontSize: 11,
  color: C.dim,
  display: "block",
  marginBottom: 4,
};

/** Wrapper style for each form field (label + input pair). */
export const FIELD_STYLE = { marginBottom: 16 };