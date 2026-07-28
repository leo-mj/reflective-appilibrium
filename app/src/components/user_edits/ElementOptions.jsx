/**
 * @fileoverview Shared <option> list for the element pickers in the add panels
 * and modals.
 * @module components/user_edits/ElementOptions
 */

/** @import { REElement } from '../../types.js' */

import { sortElementIds } from "../../utils/stateUtils.js";

/** Suffix marking elements that are selectable but not currently in play. */
const STATUS_NOTE = { withdrawn: " (withdrawn)", rejected: " (rejected)" };

/**
 * Sorted options for an element picker.
 *
 * Withdrawn and rejected elements are offered alongside active ones so a new
 * argument can be built on them, but they are labelled: picking one is a
 * deliberate act, not something to stumble into by reading bare IDs.
 *
 * @param {Object}      props
 * @param {REElement[]} props.elements
 */
export function ElementOptions({ elements }) {
  return [...elements]
    .sort((a, b) => sortElementIds(a.id, b.id))
    .map((el) => (
      <option key={el.id} value={el.id}>
        {el.id}
        {STATUS_NOTE[el.status] ?? ""}
      </option>
    ));
}
