/**
 * @fileoverview The add bar's fields, one set per tab: what an element is
 * filed under, a relation's two ends and type, and an argument's premises,
 * type and conclusion.
 *
 * They draw and nothing more. The forms they edit are held by
 * {@link module:components/user_edits/useAddBarForms}, and the text field, the
 * complaint and the buttons that act on a form belong to the bar around them.
 * Each returns a fragment, as they sit in the bar's own row of fields.
 *
 * @module components/user_edits/AddBarFields
 */

import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { ARGUMENT_GLOSS } from "../../constants/glosses.js";
import { CONFIDENCE_PRESETS } from "../../utils/confidenceLabel.js";
import { setLastOrigin } from "../../utils/lastOrigin.js";
import { Dropdown } from "./Dropdown.jsx";
import { elementTypeOptions } from "./ElementOptions.jsx";
import { relationTypeOptions } from "./RelationTypeOptions.jsx";
import { pickerWidth } from "./addPanelShared.js";
import { Field, PremisePickers } from "./addPanelPrimitives.jsx";

// The three lists that do not depend on what is on the board, built once. Each
// row carries its gloss as the detail the picker draws beside the label.
const TYPE_OPTIONS = elementTypeOptions();
const RELATION_ROWS = relationTypeOptions();
const ARGUMENT_ROWS = [
  { value: "entails", label: "entails", detail: ARGUMENT_GLOSS.entails },
  { value: "precludes", label: "precludes", detail: ARGUMENT_GLOSS.precludes },
];

/**
 * @param {Object}   props
 * @param {Object}   props.form        - `{ type, confidence, text }`.
 * @param {function(string, *): void} props.onChange - Field name, then value.
 * @param {string}   props.origin      - Who is adding; see `utils/lastOrigin`.
 * @param {Object}   props.look        - {@link module:components/user_edits/addPanelShared.barLook}.
 * @param {boolean}  props.showMeta    - Phone only: origin and confidence unfolded.
 * @param {function} props.onToggleMeta
 */
export function ElementFields({
  form,
  onChange,
  origin,
  look,
  showMeta,
  onToggleMeta,
}) {
  const { roomy, sel, ghost, box } = look;
  return (
    <>
      {/* The three are the domain's own terms, and a first-time reader
          has no way to tell a principle from a theory by the word
          alone; the gloss rides in the row beside each. */}
      <Dropdown
        label="Element type"
        value={form.type}
        onChange={(v) => onChange("type", v)}
        options={TYPE_OPTIONS}
        style={sel}
        // 9 for "Principle", the longest of the three. Roomy shares
        // the line with Details, the pair filling the row — growing
        // from their content widths rather than from nothing, since
        // `flex: 1` would start both at zero and split the row evenly,
        // which cut "Judgment" off halfway.
        layout={{
          ...pickerWidth(9),
          ...(roomy ? { flex: "1 1 auto" } : null),
        }}
      />
      {/* Both of these carry a working default, so on a phone they are
          detail rather than something to fill in: the statement is what
          the reader came to type. Folded away by default there, and
          always shown in the strip, which has the width for them. */}
      {roomy && (
        <button
          type="button"
          onClick={onToggleMeta}
          aria-expanded={showMeta}
          style={{
            ...ghost,
            flex: "1 1 auto",
            // The picker's height rather than the ghost buttons' own,
            // since it is standing beside one rather than among them.
            minHeight: sel.minHeight,
            fontSize: 14,
          }}
        >
          Details {showMeta ? "▴" : "▾"}
        </button>
      )}
      {(!roomy || showMeta) && (
        <span
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: roomy ? 16 : 8,
            flexWrap: "wrap",
            ...(roomy
              ? // A line of their own, so the two sit side by side
                // under the type picker rather than trailing off it.
                { flexBasis: "100%" }
              : // Out to the far corner of the bar. They are what the
                // element is filed under rather than part of writing
                // it, so they sit apart from the controls that are.
                { marginLeft: "auto" }),
          }}
        >
          <Field label="By" roomy={roomy}>
            <input
              aria-label="Origin"
              value={origin}
              onChange={(e) => setLastOrigin(e.target.value)}
              placeholder="Origin"
              style={{ ...box, width: roomy ? 118 : 90 }}
            />
          </Field>
          {/* L, M and H said nothing about what they set, and the number
              beside them said less. */}
          <Field label="Confidence" roomy={roomy}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {CONFIDENCE_PRESETS.map(({ label: name, value: v }) => (
                <Tooltip key={name} text={`${name} confidence`}>
                  <button
                    type="button"
                    onClick={() => onChange("confidence", v)}
                    aria-label={`${name} confidence`}
                    aria-pressed={Math.abs(form.confidence - v) < 0.01}
                    style={{
                      ...box,
                      // Single letters, so they are squared off rather
                      // than left as the slivers picker padding makes.
                      padding: roomy ? 0 : "3px 7px",
                      minWidth: roomy ? 38 : undefined,
                      background:
                        Math.abs(form.confidence - v) < 0.01
                          ? C.border
                          : "transparent",
                      fontWeight:
                        Math.abs(form.confidence - v) < 0.01
                          ? "bold"
                          : "normal",
                      cursor: "pointer",
                    }}
                  >
                    {/* Its initial: the words would not fit the strip. */}
                    {name[0]}
                  </button>
                </Tooltip>
              ))}
              <Tooltip text="Or any value between 0 and 1">
                <input
                  type="number"
                  aria-label="Confidence, 0 to 1"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.confidence}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v))
                      onChange("confidence", Math.max(0, Math.min(1, v)));
                  }}
                  // The spinner is worth its width on a mouse and nothing
                  // at all under a thumb, where it was crowding the value
                  // it steps out of the field altogether.
                  className={roomy ? "no-spinner" : undefined}
                  // Four characters ("0.67") in whatever font the reader has
                  // picked — `ch` is its own "0" — with the padding, the
                  // border and, on a mouse, the spinner beside them. At a
                  // fixed 55px the spinner left room for three, and the last
                  // digit was cut off.
                  style={{ ...box, width: "calc(4ch + 34px)" }}
                />
              </Tooltip>
            </span>
          </Field>
        </span>
      )}
    </>
  );
}

/**
 * @param {Object}   props
 * @param {Object}   props.form        - `{ from, to, type, explanation }`.
 * @param {function(string, *): void} props.onChange - Field name, then value.
 * @param {Array}    props.elementRows - What an element picker offers.
 * @param {Object}   props.idLayout    - An element picker's width.
 * @param {Object}   props.look        - {@link module:components/user_edits/addPanelShared.barLook}.
 */
export function RelationFields({ form, onChange, elementRows, idLayout, look }) {
  const { linkSel, arrow } = look;
  return (
    <>
      <Dropdown
        label="Relation from"
        value={form.from}
        onChange={(v) => onChange("from", v)}
        options={elementRows}
        style={linkSel}
        layout={idLayout}
      />
      <span style={arrow}>→</span>
      <Dropdown
        label="Relation type"
        value={form.type}
        onChange={(v) => onChange("type", v)}
        options={RELATION_ROWS}
        // The colour goes on the trigger, so the chevron and the list's
        // own labels take it too.
        style={{ ...linkSel, color: C[form.type] }}
        // 10 for "undermines", the longest offered.
        layout={pickerWidth(10)}
      />
      <span style={arrow}>→</span>
      <Dropdown
        label="Relation to"
        value={form.to}
        onChange={(v) => onChange("to", v)}
        options={elementRows}
        style={linkSel}
        layout={idLayout}
      />
    </>
  );
}

/** The two places an argument's premises and conclusion can come from. */
const ARGUMENT_MODES = [
  {
    mode: "write",
    label: "Write",
    title:
      "Write premises and conclusion out as new statements, mixed with elements from the board as you like",
  },
  {
    mode: "pick",
    label: "Pick",
    title: "Build it from elements already on the board",
  },
];

/**
 * The row above the written argument's stack, or the whole of a picked one.
 *
 * @param {Object}   props
 * @param {Object}   props.form        - `{ premises, conclusion, negated, explanation }`.
 * @param {function(string, *): void} props.onChange - Field name, then value.
 * @param {boolean}  props.canWrite    - Whether writing one out is on offer.
 * @param {"write"|"pick"} props.mode
 * @param {function(string): void} props.onModeChange
 * @param {boolean}  props.writing     - Written out, in the stack under the row.
 * @param {function(number, string): void} props.onSetPremise
 * @param {function(number): void} props.onRemovePremise
 * @param {function(): void} props.onAddPremise
 * @param {boolean}  props.canAddPremise
 * @param {Array}    props.elementRows - What an element picker offers.
 * @param {Object}   props.idLayout    - An element picker's width.
 * @param {Object}   props.look        - {@link module:components/user_edits/addPanelShared.barLook}.
 */
export function ArgumentFields({
  form,
  onChange,
  canWrite,
  mode,
  onModeChange,
  writing,
  onSetPremise,
  onRemovePremise,
  onAddPremise,
  canAddPremise,
  elementRows,
  idLayout,
  look,
}) {
  const { linkSel, ghost, arrow } = look;
  const { premises, conclusion, negated } = form;
  return (
    <>
      {/* Where the premises and conclusion come from: the board, or
          the fields below. A pair of pressed buttons rather than a
          picker, since both choices are worth seeing at once. */}
      {canWrite && (
        <span
          role="group"
          aria-label="Argument from"
          style={{ display: "flex", gap: 0, flexShrink: 0 }}
        >
          {ARGUMENT_MODES.map(({ mode: m, label, title }, i) => {
            const on = mode === m;
            return (
              <Tooltip key={m} text={title}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onModeChange(m)}
                  style={{
                    ...ghost,
                    borderRadius: i === 0 ? "4px 0 0 4px" : "0 4px 4px 0",
                    marginLeft: i === 0 ? 0 : -1,
                    background: on ? C.border : "transparent",
                    color: on ? C.text : C.dim,
                    fontWeight: on ? "bold" : "normal",
                  }}
                >
                  {label}
                </button>
              </Tooltip>
            );
          })}
        </span>
      )}
      {/* Premises, joined by +. One argument can rest on several, and
          they are added a row at a time rather than by a count field.
          The assist tabs' panel draws the same run from the same
          component — see {@link PremisePickers}. Written out, they
          are in the stack under this row instead. */}
      {!writing && (
        <PremisePickers
          premises={premises}
          options={elementRows}
          layout={idLayout}
          selectStyle={linkSel}
          ghostStyle={ghost}
          arrowStyle={arrow}
          onChange={onSetPremise}
          onRemove={onRemovePremise}
          onAdd={onAddPremise}
          canAdd={canAddPremise}
        />
      )}
      <Dropdown
        label="Argument type"
        value={negated ? "precludes" : "entails"}
        onChange={(v) => onChange("negated", v === "precludes")}
        options={ARGUMENT_ROWS}
        // The colour goes on the trigger, so the chevron and the list's
        // own labels take it too.
        style={{
          ...linkSel,
          color: negated ? C.precludes : C.entails,
        }}
        // 9 for "precludes".
        layout={pickerWidth(9)}
      />
      {!writing && (
        <>
          <span style={arrow}>→</span>
          <Dropdown
            label="Conclusion"
            value={conclusion}
            onChange={(v) => onChange("conclusion", v)}
            options={elementRows}
            style={linkSel}
            layout={idLayout}
          />
        </>
      )}
    </>
  );
}
