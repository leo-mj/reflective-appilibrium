/**
 * @fileoverview The two controls the add bar is built from.
 *
 * Split out of TextTabAddPanel, which had grown to hold three tab modes, three
 * sizes, and these. Their styling lives in addPanelShared.js alongside the rest
 * of the bar's sizing.
 *
 * @module components/user_edits/addPanelPrimitives
 */

import { C } from "../../constants/colors.js";

/**
 * The chevron a select draws for itself, drawn by us instead — see
 * {@link module:components/user_edits/addPanelShared.selectStyle} for why we
 * take it over.
 *
 * Laid over the picker rather than painted into its background, so that it
 * inherits the picker's own colour: a background image would have to name one,
 * and a data URI cannot see the CSS variables the rest of the bar is coloured
 * from — it would be a fixed grey in both themes, and grey on the relation-type
 * picker, which colours its text by the relation.
 */
const chevronStyle = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 10,
  lineHeight: 1,
  // Colour comes from the picker; the arrow is not meant to shout as loudly.
  opacity: 0.6,
  // The picker is what should answer a click anywhere in its box.
  pointerEvents: "none",
};

/**
 * A picker: a `<select>` with the chevron over it. Anything that positions the
 * picker — a width, a share of a row — goes on the wrapper, since the wrapper
 * is what the surrounding layout now sees; the select fills it.
 *
 * @param {Object} props
 * @param {Object} props.style - The select's own box, from `selectStyle`.
 * @param {Object} [props.layout] - Passed to the wrapper: flex, width, and the
 *   like. The select is stretched to whatever it settles at.
 */
export function Picker({ style, layout, children, ...props }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        // The chevron reads `currentColor`, so the colour the select is drawn
        // in has to reach it — and it is the wrapper the arrow sits in.
        color: style.color,
        ...layout,
      }}
    >
      <select {...props} style={{ ...style, width: "100%" }}>
        {children}
      </select>
      <span aria-hidden="true" style={chevronStyle}>
        ▾
      </span>
    </span>
  );
}

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
