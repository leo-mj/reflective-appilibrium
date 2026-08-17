/**
 * @fileoverview One on/off row of the header's ☰ menu.
 * @module components/app_header/MenuToggle
 */

import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { menuIconStyle } from "./appHeaderStyles.js";

/**
 * The switch beside a row's label. Decorative: the state it draws is on the
 * button's `aria-pressed`, which is what a screen reader reads.
 *
 * @param {{on: boolean}} props
 */
function Switch({ on }) {
  return (
    <span
      aria-hidden="true"
      style={{
        marginLeft: "auto",
        width: 22,
        height: 12,
        flexShrink: 0,
        borderRadius: 6,
        boxSizing: "border-box",
        border: `1px solid ${on ? C.supports : C.border}`,
        background: on ? C.supports : "transparent",
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 12 : 2,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: on ? C.panel : C.dim,
        }}
      />
    </span>
  );
}

/**
 * A setting that is either on or off, named by a label that never changes.
 *
 * The rows used to flip their own wording — "Hide nav bar" became "Show nav
 * bar" — which left every one of them ambiguous: "Dark mode" was the change on
 * offer while "Arguments only" read as the state in force, and nothing in the
 * row said which. Here the label names the setting and the switch says whether
 * it is on, so both readings are visible at once and every row reads alike.
 *
 * Clicking does not close the menu: these change something in place, and the
 * switch is the only evidence of it.
 *
 * @param {Object}          props
 * @param {React.ReactNode} props.icon     - Glyph or SVG, fixed like the label.
 * @param {string}          props.label    - Names the setting, not the change.
 * @param {boolean}         props.on
 * @param {() => void}      props.onToggle
 * @param {string}          [props.tooltip] - Omitted leaves the row untooltipped.
 * @param {Object}          props.style     - The layout's own menu-row style.
 */
export function MenuToggle({
  icon,
  label,
  on,
  onToggle,
  tooltip,
  style,
  ...rest
}) {
  return (
    <Tooltip text={tooltip}>
      <button
        onClick={onToggle}
        aria-pressed={on}
        // Spelt out because the visible state is a coloured switch, and because
        // Tooltip otherwise names the button after its tooltip prose. Opens
        // with the label so it still matches what is on screen.
        aria-label={`${label}: ${on ? "on" : "off"}`}
        style={{ ...style, textAlign: "left" }}
        {...rest}
      >
        <span style={menuIconStyle}>{icon}</span>
        {label}
        <Switch on={on} />
      </button>
    </Tooltip>
  );
}
