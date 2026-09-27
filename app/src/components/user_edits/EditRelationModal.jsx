/**
 * @fileoverview Modal dialog for revising a single RE relation, or an argument.
 * @module components/EditRelationModal
 */

/** @import { RERelation } from '../../types.js' */

import { useState } from "react";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { relationTypeOptions } from "./RelationTypeOptions.jsx";
import { argumentRelationType, sortElementIds } from "../../utils/stateUtils.js";

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
 * **An argument is revised whole.** Given `argument`, the relations that make
 * it up, it offers what adding one does: Entails or Precludes, the "jointly"
 * form following from the number of premises. It used to offer every relation
 * type for the one premise row pressed. Supports, Conflicts or Undermines took
 * that step out of the argument, and since the default view shows arguments
 * only, the argument appeared to have been deleted; a different inferential
 * type left one argument with premises disagreeing about what they establish.
 *
 * @param {Object}      props
 * @param {RERelation}  props.relation
 * @param {RERelation[]|null} [props.argument] - Every relation of the argument
 *   `relation` belongs to, or null for a relation that is not an argument step.
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
  argument = null,
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

  const nextRound = `create Round ${currentRound + 1}`;

  if (argument) {
    const negated = form.type.endsWith("precludes");
    const premises = argument.map((r) => r.from).sort(sortElementIds);
    return (
      <ModalShell
        title="Revise argument"
        subtitle={`${premises.join(", ")} → ${relation.to} · Saving will mark this argument as revised and ${nextRound}`}
        onCancel={onCancel}
        onSave={() => onSave(form)}
      >
        <FormField label="Relation to conclusion">
          <select
            value={negated ? "precludes" : "entails"}
            onChange={(e) =>
              set(
                "type",
                argumentRelationType(argument.length, e.target.value === "precludes"),
              )
            }
            style={INPUT_STYLE}
          >
            <option value="entails">Entails</option>
            <option value="precludes">Precludes</option>
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
