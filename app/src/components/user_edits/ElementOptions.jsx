/**
 * @fileoverview The rows an element picker offers, for the add panels and the
 * modals alike.
 *
 * Data rather than `<option>` elements: the pickers are
 * {@link module:components/user_edits/Dropdown}s now, and a row there is a
 * label, the statement drawn beside it, and a status note held out at the right.
 *
 * @module components/user_edits/ElementOptions
 */

/** @import { REElement } from '../../types.js' */
/** @import { DropdownOption } from './Dropdown.jsx' */

import { STATUS_NOTE, elementDetail } from "../../constants/glosses.js";
import { sortElementIds } from "../../utils/stateUtils.js";

/**
 * The three element types.
 *
 * No gloss on these, unlike the relation types: Judgment, Principle and Theory
 * are three words the reader has already met on the tabs, in the legend and on
 * the nodes, and a sentence apiece under a control offering three of them is
 * noise where the words are doing the work.
 *
 * @param {string} [theoryLabel] - The modal writes theories out in full; the
 *   strip has a row's width and calls them Theory.
 * @returns {DropdownOption[]}
 */
export const elementTypeOptions = (theoryLabel = "Theory") => [
  { value: "judgment", label: "Judgment" },
  { value: "principle", label: "Principle" },
  { value: "theory", label: theoryLabel },
];

/**
 * Sorted rows for an element picker.
 *
 * Withdrawn and rejected elements are offered alongside active ones so a new
 * argument can be built on them, but they are marked: picking one is a
 * deliberate act, not something to stumble into by reading bare IDs. The mark
 * is its own column rather than a suffix on the id — see `STATUS_STYLE` in
 * Dropdown for why.
 *
 * The label is the id, because that is what the closed picker has room for and
 * what the graph writes on the node. The statement rides beside it as `detail`,
 * which is the whole reason these lists are ours to draw.
 *
 * @param {REElement[]} elements
 * @returns {DropdownOption[]}
 */
export function elementOptions(elements) {
  return [...elements]
    .sort((a, b) => sortElementIds(a.id, b.id))
    .map((el) => ({
      value: el.id,
      label: el.id,
      detail: elementDetail(el),
      status: STATUS_NOTE[el.status],
    }));
}
