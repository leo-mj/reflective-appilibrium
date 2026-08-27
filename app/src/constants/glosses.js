/**
 * @fileoverview What a picker's rows say — the one-line meaning of a relation
 * type, and the statement behind an element id.
 *
 * A picker reading `J1 → undermines → P2` is a term of art between two ids: it
 * says what will be recorded and nothing about what it means. These are what
 * {@link module:components/user_edits/Dropdown} draws beside each row's label,
 * where the reader is already looking rather than behind a hover.
 *
 * The relation glosses are written in terms of **From** and **To**, which is
 * what both surfaces offering them call the two ends — the add bar labels its
 * pickers "Relation from"/"Relation to", and `AddRelationModal` captions the
 * fields "From" and "To". Source/target is the wording in `types.js` and is the
 * right one there; here the reader is looking at a labelled form, and the label
 * is what they can check the sentence against.
 *
 * **Element types carry no gloss.** Judgment, Principle and Theory are three
 * words the reader has met on the tabs, in the legend and on the nodes, and a
 * sentence apiece under a picker offering three of them is noise where the
 * words are doing the work. Relation types are the opposite case: "undermines"
 * and "depends on" are not guessable from the label.
 *
 * The wording follows the domain model in the root CLAUDE.md. Keep each to a
 * single clause: it is a line in a row, not the documentation.
 *
 * @module constants/glosses
 */

/** @import { REElement } from '../types.js' */

/**
 * The six types a two-endpoint picker offers: the dialectical four, then the
 * single-premise inferential pair. The joint forms are absent for the reason
 * they are absent from the picker — they need more than one premise, so they
 * are made in the argument panels, where {@link ARGUMENT_GLOSS} covers them.
 *
 * @type {Record<string, string>}
 */
export const RELATION_GLOSS = {
  supports: "From provides a positive reason for To",
  conflicts: "From and To are incompatible",
  undermines: "From weakens To without flatly contradicting it",
  depends: "From presupposes To",
  entails: "From entails To",
  precludes: "From entails the negation of To",
};

/**
 * The same pair as an argument reads it, where the ends are not From and To but
 * the premises and the conclusion — and where one premise or several is the
 * form's own business rather than the reader's, so the wording covers both.
 *
 * @type {Record<'entails'|'precludes', string>}
 */
export const ARGUMENT_GLOSS = {
  entails: "The premises together entail the conclusion",
  precludes: "The premises together entail the negation of the conclusion",
};

// ─── Elements ─────────────────────────────────────────────────────────────────

/**
 * What an element that is selectable but not currently in play is marked with.
 *
 * A word, not a suffix: the picker holds it out in its own column at the right
 * of the row rather than running it onto the id, which is what stopped the
 * statements beside them lining up. See `STATUS_STYLE` in Dropdown.
 */
export const STATUS_NOTE = { withdrawn: "withdrawn", rejected: "rejected" };

/**
 * What a picker's open list draws beside an element's id: the statement, and
 * nothing else. The id is the row's label already, and the status is its own
 * column, so neither belongs here.
 *
 * Uncut: the row clamps itself to two lines, which follows the list's width
 * rather than guessing at it.
 *
 * @param {REElement} [el]
 * @returns {string|undefined}
 */
export const elementDetail = (el) => el?.text?.trim() || undefined;
