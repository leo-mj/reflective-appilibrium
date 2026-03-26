/**
 * @fileoverview Modal dialog for revising a single RE relation.
 * @module components/EditRelationModal
 */

/** @import { RERelation } from '../../types.js' */

import { useState } from "react";
import {
  INPUT_STYLE,
  LABEL_STYLE,
  FIELD_STYLE,
} from "../../constants/modalConstants.js";
import { ModalShell } from "./ModalShell.jsx";

/**
 * @typedef {Object} EditRelationFormData
 * @property {'supports'|'conflicts'|'undermines'|'depends'} type
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
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Relation type</label>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          style={INPUT_STYLE}
        >
          <option value="supports">Supports</option>
          <option value="conflicts">Conflicts</option>
          <option value="undermines">Undermines</option>
          <option value="depends">Depends</option>
        </select>
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Explanation</label>
        <textarea
          value={form.explanation}
          onChange={(e) => set("explanation", e.target.value)}
          style={{ ...INPUT_STYLE, height: 110, resize: "vertical" }}
        />
      </div>
    </ModalShell>
  );
}
