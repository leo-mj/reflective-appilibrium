import { C } from "../../constants/colors.js";
import { defaultPickerIds } from "../../utils/stateUtils.js";

export const SELECT_STYLE = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.text,
  padding: "3px 6px",
  fontSize: 14,
};

export const PANEL_STYLE = {
  flexShrink: 0,
  borderTop: `1px solid ${C.border}`,
  background: C.panel,
  display: "flex",
  flexDirection: "column",
  padding: "8px 16px",
  minHeight: "14vh",
};

/** @param {import('../../types.js').REElement[]} elements */
export function makeRelationDefaults(elements) {
  const ids = defaultPickerIds(elements);
  return {
    from: ids[0] ?? "",
    to: ids[1] ?? "",
    type: "supports",
    explanation: "",
  };
}
