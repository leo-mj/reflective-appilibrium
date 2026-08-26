/**
 * @fileoverview What is left of the add bar's own small parts.
 *
 * Split out of TextTabAddPanel, which had grown to hold three tab modes, three
 * sizes, and these. Its styling lives in addPanelShared.js alongside the rest of
 * the bar's sizing.
 *
 * The pickers used to live here too, as a `<select>` with a chevron drawn over
 * it. They are {@link module:components/user_edits/Dropdown} now, for the reason
 * that file opens with: a native list cannot show what an id stands for.
 *
 * @module components/user_edits/addPanelPrimitives
 */

import { C } from "../../constants/colors.js";

/**
 * A control with its caption — above it where the bar is roomy, beside it in
 * the strip. Roomy lays several of these out side by side, and a caption of a
 * fixed height above each one is what makes their controls line up rather than
 * sit at whatever height their own label happened to leave them.
 */
export function Field({ label, roomy, children }) {
  return (
    <span
      style={{
        display: "flex",
        flexDirection: roomy ? "column" : "row",
        alignItems: roomy ? "flex-start" : "center",
        gap: roomy ? 3 : 6,
      }}
    >
      <span style={{ fontSize: 11, color: C.dim, lineHeight: 1.2 }}>
        {label}
      </span>
      {children}
    </span>
  );
}
