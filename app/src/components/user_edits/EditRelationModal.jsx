/**
 * @fileoverview Modal dialog for revising a single RE relation.
 * @module components/EditRelationModal
 */

/** @import { RERelation } from '../../types.js' */

import { useState } from "react";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { relationTypeOptions } from "./RelationTypeOptions.jsx";
import { makeDiff, RELATION_EDIT_FIELDS } from "../../utils/stateUtils.js";

/**
 * @typedef {Object} EditRelationFormData
 * @property {string} type
 * @property {string} explanation
 */

const RELATION_OPTIONS = relationTypeOptions({ capitalized: true });
const ARGUMENT_OPTIONS = RELATION_OPTIONS.filter((o) => o.group === "Argument");

/**
 * Modal for revising the type and explanation of an RE relation.
 * The `from` and `to` endpoints are read-only (changing them would alter identity).
 *
 * **An argument is not revised here** but in `ReviseArgumentModal`, which
 * takes its premises too; `EditModals` sends it there.
 *
 * @param {Object}      props
 * @param {RERelation}  props.relation
 * @param {boolean}     [props.argumentsOnly] - The view is hiding relations
 *   that are not argument steps. Offering one would save a relation the view
 *   then hides, so only entails and precludes are offered, as the add bar does.
 * @param {number}      props.currentRound
 * @param {function(EditRelationFormData): void} props.onSave
 * @param {function(): void}                     props.onCancel
 * @returns {React.ReactElement}
 */
export function EditRelationModal({
  relation,
  argumentsOnly = false,
  currentRound,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState({
    type: relation.type,
    explanation: relation.explanation,
  });

  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  // Off until something differs: an unchanged save is not a revision.
  const unchanged = !makeDiff(RELATION_EDIT_FIELDS, relation, form).length;

  const nextRound = `record it as step ${currentRound + 1}`;

  // The relation's own type stays selectable even where it is not offered — a
  // joint step saved without the argument it belonged to, or a dialectical
  // relation reached while those are hidden — so the form opens on it.
  const offered = argumentsOnly ? ARGUMENT_OPTIONS : RELATION_OPTIONS;
  const options = offered.some((o) => o.value === relation.type)
    ? offered
    : [
        ...offered,
        RELATION_OPTIONS.find((o) => o.value === relation.type) ?? {
          value: relation.type,
          label: relation.type,
        },
      ];

  return (
    <ModalShell
      title="Revise relation"
      subtitle={`${relation.from} → ${relation.to} · Saving will mark this relation as revised and ${nextRound}`}
      onCancel={onCancel}
      onSave={() => onSave(form)}
      saveDisabled={unchanged}
    >
      <FormField label="Relation type">
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          style={INPUT_STYLE}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Explanation">
        <textarea
          value={form.explanation}
          onChange={(e) => set("explanation", e.target.value)}
          style={{ ...INPUT_STYLE, height: 110, resize: "vertical" }}
        />
      </FormField>
    </ModalShell>
  );
}
