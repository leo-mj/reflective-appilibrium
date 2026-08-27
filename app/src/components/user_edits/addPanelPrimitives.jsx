/**
 * @fileoverview What is left of the add bar's own small parts — a captioned
 * control, and the run of premise pickers both argument forms are built from.
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
import { Dropdown } from "./Dropdown.jsx";

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

/**
 * The premises of an argument: a run of pickers joined by `+`, each with the
 * button that drops it, and the button that adds another.
 *
 * Shared by the two argument forms — the strip's Argument tab and the assist
 * tabs' own panel — because the layout is the point of it. Every premise is one
 * cell of the same width, so a run of them long enough to wrap comes down in
 * columns rather than at whatever offset the line above happened to end at; and
 * the two forms are one control in two places, so a premise added in an assist
 * tab must sit where a premise added in the strip sits.
 *
 * Returned loose rather than in a box of their own: a box could only wrap
 * within itself, and it is the row outside that has the width to give.
 *
 * @param {Object}   props
 * @param {string[]} props.premises
 * @param {import('./Dropdown.jsx').DropdownOption[]} props.options
 * @param {Object}   props.layout   - The picker's width; see `pickerWidth`.
 * @param {Object}   props.selectStyle - The picker's box, from `selectStyle`.
 * @param {Object}   props.ghostStyle  - The two buttons' box, from `ghostBtn`.
 * @param {Object}   props.arrowStyle  - The `+` between two premises.
 * @param {function(number, string): void} props.onChange
 * @param {function(number): void} props.onRemove
 * @param {function} props.onAdd
 * @param {boolean}  props.canAdd - False once every element is spoken for.
 */
export function PremisePickers({
  premises,
  options,
  layout,
  selectStyle,
  ghostStyle,
  arrowStyle,
  onChange,
  onRemove,
  onAdd,
  canAdd,
}) {
  return (
    <>
      {premises.map((premise, i) => (
        <span
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <Dropdown
            // Numbered, because there may be several: "Premise" alone would
            // give every one of them the same name, which is what a screen
            // reader user hears as one control repeated.
            label={`Premise ${i + 1}`}
            value={premise}
            onChange={(v) => onChange(i, v)}
            options={options}
            style={selectStyle}
            layout={layout}
          />
          {premises.length > 1 && (
            <button
              onClick={() => onRemove(i)}
              aria-label={`Remove premise ${i + 1}`}
              title={`Remove premise ${i + 1}`}
              style={ghostStyle}
            >
              ✕
            </button>
          )}
          {i < premises.length - 1 && <span style={arrowStyle}>+</span>}
        </span>
      ))}
      <button
        onClick={onAdd}
        disabled={!canAdd}
        style={{ ...ghostStyle, opacity: canAdd ? 1 : 0.4 }}
      >
        + premise
      </button>
    </>
  );
}
