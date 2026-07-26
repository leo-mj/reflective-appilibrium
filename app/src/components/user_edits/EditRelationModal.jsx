/**
 * @fileoverview Modal dialog for revising a single RE relation.
 * @module components/EditRelationModal
 */

/** @import { RERelation } from '../../types.js' */

import { useState } from "react";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";

/**
 * @typedef {Object} EditRelationFormData
 * @property {'supports'|'conflicts'|'undermines'|'depends'|'entails'} type
 * @property {string} explanation
 */

/**
 * Modal for revising the type and explanation of an RE relation.
 * The `from` and `to` endpoints are read-only (changing them would alter identity).
 *
 * @param {Object}      props
 * @param {RERelation}  props.relation
 * @param {number}      props.currentRound
 * @param {function(EditRelationFormData): void} props.onSave
 * @param {function(): void}                     props.onCancel
 * @returns {React.ReactElement}
 */
export function EditRelationModal({
  relation,
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

  return (
    <ModalShell
      title="Revise relation"
      subtitle={`${relation.from} → ${relation.to} · Saving will mark this relation as revised and create Round ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() => onSave(form)}
    >
      <FormField label="Relation type">
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          style={INPUT_STYLE}
        >
          <option value="supports">Supports</option>
          <option value="conflicts">Conflicts</option>
          <option value="undermines">Undermines</option>
          <option value="depends">Depends on</option>
          <option value="entails">Entails</option>
          <option value="precludes">Precludes</option>
          <option value="jointly_entails">Jointly Entails</option>
          <option value="jointly_precludes">Jointly Precludes</option>
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
