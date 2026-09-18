/**
 * @fileoverview The argument tab's second way in: premises and conclusion
 * stacked one to a line, each either written out as a new statement or taken
 * from the board.
 *
 * Premises first and the conclusion last — the order an argument is read in.
 * It opens with one of each; `+ premise` adds another above the conclusion.
 *
 * Each line has one picker saying where its statement comes from: a new
 * judgment, principle or theory, or an element already on the board. One
 * control rather than a switch plus a picker, since "which type of new thing"
 * and "which existing thing" are the same question — what goes on this line.
 * An existing element's text is shown in place of the field, read-only: it is
 * edited where it lives, not here.
 *
 * Nothing here adds anything: the bar's own Add does, through
 * `handleAddNewArgument`, which puts any new elements and the relations into
 * state as one change.
 *
 * @module components/user_edits/WrittenArgumentFields
 */

/** @import { REElement } from '../../types.js' */
/** @import { DropdownOption } from './Dropdown.jsx' */

import { C } from "../../constants/colors.js";
import { Dropdown } from "./Dropdown.jsx";
import { elementOptions } from "./ElementOptions.jsx";
import {
  EXPLANATION_STYLE,
  pickerWidth,
  slotSource,
  TEXT_FIELD_MIN_HEIGHT,
} from "./addPanelShared.js";

const NEW_GROUP = "New";
const BOARD_GROUP = "On the board";
const NEW_OPTIONS = [
  { value: "new:judgment", label: "New judgment", group: NEW_GROUP },
  { value: "new:principle", label: "New principle", group: NEW_GROUP },
  { value: "new:theory", label: "New theory", group: NEW_GROUP },
];

/**
 * @param {Object}   props
 * @param {{premises: import('./addPanelShared.js').ArgumentSlot[],
 *   conclusion: import('./addPanelShared.js').ArgumentSlot}} props.form
 * @param {function(Object): void} props.onChange - Takes the whole form back.
 * @param {REElement[]} props.elements - What a line may be taken from.
 * @param {function(KeyboardEvent): void} props.onKeyDown - The bar's own
 *   ctrl-enter, so every field submits the way the explanation does.
 * @param {Object}   props.selectStyle - The source pickers' box.
 * @param {Object}   props.ghostStyle  - `+ premise` and the ✕ buttons.
 * @param {Object}   props.arrowStyle  - The gutter marks.
 * @param {boolean}  props.roomy
 * @param {number}   props.generation - Keys the fields, as the bar's own field
 *   is keyed, so Clear takes the browser's undo stack with it.
 */
export function WrittenArgumentFields({
  form,
  onChange,
  elements,
  onKeyDown,
  selectStyle,
  ghostStyle,
  arrowStyle,
  roomy,
  generation,
}) {
  const { premises, conclusion } = form;
  /** @type {DropdownOption[]} */
  const options = [
    ...NEW_OPTIONS,
    ...elementOptions(elements).map((o) => ({ ...o, group: BOARD_GROUP })),
  ];
  const byId = new Map(elements.map((e) => [e.id, e]));

  const setPremise = (i, patch) =>
    onChange({
      ...form,
      premises: premises.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    });
  const setConclusion = (patch) =>
    onChange({ ...form, conclusion: { ...conclusion, ...patch } });
  const addPremise = () =>
    onChange({
      ...form,
      premises: [...premises, { type: "principle", text: "" }],
    });
  const removePremise = (i) =>
    onChange({ ...form, premises: premises.filter((_, j) => j !== i) });

  /**
   * What choosing a source does to a line. The text written so far is kept
   * when an element is picked over it, so changing one's mind and going back
   * to "New" does not cost the sentence.
   */
  const sourcePatch = (value) =>
    value.startsWith("new:")
      ? { id: undefined, type: value.slice(4) }
      : { id: value };

  const field = {
    ...EXPLANATION_STYLE,
    // Not the bar's growing field: every statement gets the same room, and
    // it is the explanation below them that takes what is left over.
    flex: 1,
    marginTop: 0,
    minHeight: roomy ? 64 : TEXT_FIELD_MIN_HEIGHT,
    ...(roomy ? { padding: "10px 12px", fontSize: 16 } : null),
  };

  /**
   * One line: a gutter mark, where its statement comes from, and the statement.
   * The gutter holds the premise's number or the conclusion's ∴, so the stack
   * reads as an argument before any of it is filled in.
   */
  const row = ({ key, mark, name, slot, onEdit, placeholder, remove }) => {
    const picked = slot.id ? byId.get(slot.id) : null;
    return (
      <div
        key={`${key}-${generation}`}
        style={{ display: "flex", alignItems: "flex-start", gap: 6 }}
      >
        <span
          aria-hidden="true"
          style={{
            ...arrowStyle,
            width: "1.5em",
            flexShrink: 0,
            textAlign: "center",
            paddingTop: 6,
          }}
        >
          {mark}
        </span>
        <Dropdown
          label={`${name} source`}
          value={slotSource(slot)}
          onChange={(v) => onEdit(sourcePatch(v))}
          options={options}
          style={selectStyle}
          // 13 for "New principle", the longest label either group offers.
          layout={pickerWidth(13)}
        />
        {picked ? (
          // The element's own words, as the text panel shows them. Not a
          // field: an argument is no place to reword a statement it rests on.
          <div
            aria-label={name}
            style={{
              ...field,
              color: C.dim,
              background: "transparent",
              borderStyle: "dashed",
            }}
          >
            {picked.text}
          </div>
        ) : (
          <textarea
            aria-label={name}
            value={slot.text}
            onChange={(e) => onEdit({ text: e.target.value })}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            style={field}
          />
        )}
        {remove}
      </div>
    );
  };

  return (
    <div
      role="group"
      aria-label="Written argument"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginTop: roomy ? 12 : 8,
        flexShrink: 0,
      }}
    >
      {premises.map((p, i) =>
        row({
          key: `p${i}`,
          mark: i + 1,
          // Numbered, as the pickers are: several fields all called "Premise"
          // are one control repeated to a screen reader.
          name: `Premise ${i + 1}`,
          slot: p,
          onEdit: (patch) => setPremise(i, patch),
          placeholder: `Premise ${i + 1}…`,
          remove:
            premises.length > 1 ? (
              <button
                onClick={() => removePremise(i)}
                aria-label={`Remove premise ${i + 1}`}
                title={`Remove premise ${i + 1}`}
                style={{ ...ghostStyle, flexShrink: 0 }}
              >
                ✕
              </button>
            ) : null,
        }),
      )}
      {/* Under the premises it adds to, and above the conclusion it does not:
          where the new line will appear is where the button is. */}
      <button
        onClick={addPremise}
        style={{
          ...ghostStyle,
          alignSelf: "flex-start",
          marginLeft: "calc(1.5em + 6px)",
        }}
      >
        + premise
      </button>
      {row({
        key: "c",
        mark: "∴",
        name: "Conclusion",
        slot: conclusion,
        onEdit: setConclusion,
        placeholder: "Conclusion…",
      })}
      <span style={{ fontSize: 11, color: C.dim }}>
        Each line is a new statement or one already on the board; new ones are
        added as elements, and all of them joined into one argument.
      </span>
    </div>
  );
}
