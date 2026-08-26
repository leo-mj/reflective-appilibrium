/**
 * @fileoverview Driving a {@link module:components/user_edits/Dropdown} from a
 * test, in place of the `fireEvent.change(select, …)` the pickers answered to
 * while they were `<select>`s.
 *
 * Not imported by anything the app ships — it exists so the five test files
 * that drive a picker say what they mean rather than each re-deriving how the
 * listbox is built.
 *
 * @module components/user_edits/dropdownTestUtils
 */

import { fireEvent, screen, within } from "@testing-library/react";

/** The picker named `label` — its trigger, which is what carries the name. */
export const picker = (label) => screen.getByRole("combobox", { name: label });

/**
 * The value a picker is holding — the id or the type, not the label drawn for
 * it. `J2 (withdrawn)` is what the reader sees; `J2` is what is being chosen.
 */
export const pickerValue = (label) => picker(label).dataset.value;

/** The label a picker is drawing, status note and all. */
export const pickerLabel = (label) => picker(label).textContent;

/** Every picker in `container`, in document order. */
export const pickers = (container) => [
  ...container.querySelectorAll('[role="combobox"]'),
];

/** What each picker in `container` holds, by position rather than by name. */
export const pickerValues = (container) =>
  pickers(container).map((p) => p.dataset.value);

/**
 * Opens a picker and returns its list. The list is portalled to the body, so it
 * is looked up there rather than in the render's own container.
 */
export function openPicker(label) {
  const trigger = picker(label);
  if (trigger.getAttribute("aria-expanded") !== "true")
    fireEvent.click(trigger);
  return screen.getByRole("listbox", { name: label });
}

/**
 * The rows an open picker is offering, as `[label, detail, status?]`. The
 * detail cell is always drawn — it is what holds the status against the right
 * edge — so an option with no statement reads as `["J1", ""]`.
 *
 * The tick gutter is skipped along with anything else hidden from the reading
 * order: it is decoration on top of the row's own `aria-selected`.
 */
export const rowsOf = (list) =>
  within(list)
    .getAllByRole("option")
    .map((o) =>
      [...o.children]
        .filter((c) => c.getAttribute("aria-hidden") !== "true")
        .map((c) => c.textContent),
    );

/** The row a picker is holding, by the flag a screen reader reads it from. */
export const selectedRow = (list) =>
  within(list)
    .getAllByRole("option")
    .find((o) => o.getAttribute("aria-selected") === "true");

/** Just the labels, for the tests that are about what is on offer. */
export const labelsOf = (list) => rowsOf(list).map(([label]) => label);

/**
 * Picks a row by its value rather than by its label — the modals title-case
 * their relation types and the strip does not, and both are choosing `entails`.
 */
export function choose(label, value) {
  const list = openPicker(label);
  const row = list.querySelector(`[role="option"][data-value="${value}"]`);
  if (!row) throw new Error(`No "${value}" in the ${label} picker`);
  fireEvent.click(row);
}
