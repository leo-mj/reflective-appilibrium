/**
 * @fileoverview Shared <option> groups for the relation-type pickers.
 * @module components/user_edits/RelationTypeOptions
 */

const DIALECTICAL = [
  ["supports", "supports"],
  ["conflicts", "conflicts"],
  ["undermines", "undermines"],
  ["depends", "depends on"],
];

const ARGUMENT = [
  ["entails", "entails"],
  ["precludes", "precludes"],
];

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * The relation types a two-endpoint form can express, grouped so the
 * formal-inference pair reads as a different kind of thing from the dialectical
 * four. `jointly_entails`/`jointly_precludes` are absent by design: they need
 * more than one premise, so they come from the argument panels instead.
 *
 * @param {Object}  props
 * @param {boolean} [props.capitalized] - Title-case labels, to match modal styling.
 */
export function RelationTypeOptions({ capitalized = false }) {
  const label = (text) => (capitalized ? capitalize(text) : text);
  return (
    <>
      <optgroup label="Dialectical">
        {DIALECTICAL.map(([value, text]) => (
          <option key={value} value={value}>
            {label(text)}
          </option>
        ))}
      </optgroup>
      <optgroup label="Argument">
        {ARGUMENT.map(([value, text]) => (
          <option key={value} value={value}>
            {label(text)}
          </option>
        ))}
      </optgroup>
    </>
  );
}
