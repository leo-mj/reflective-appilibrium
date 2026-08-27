/**
 * @fileoverview The rows a relation-type picker offers.
 * @module components/user_edits/RelationTypeOptions
 */

/** @import { DropdownOption } from './Dropdown.jsx' */

import { RELATION_GLOSS } from "../../constants/glosses.js";

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
 * Each carries its one-line gloss as the row's `detail` — six terms of art
 * offered as bare words, of which "undermines" and "depends on" are the pair no
 * one guesses from the label. See {@link module:constants/glosses}.
 *
 * @param {Object}  [options]
 * @param {boolean} [options.capitalized] - Title-case labels, to match modal styling.
 * @returns {DropdownOption[]}
 */
export function relationTypeOptions({ capitalized = false } = {}) {
  const row =
    (group) =>
    ([value, text]) => ({
      value,
      label: capitalized ? capitalize(text) : text,
      detail: RELATION_GLOSS[value],
      group,
    });
  return [
    ...DIALECTICAL.map(row("Dialectical")),
    ...ARGUMENT.map(row("Argument")),
  ];
}
