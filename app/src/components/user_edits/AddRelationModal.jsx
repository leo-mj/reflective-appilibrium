/**
 * @fileoverview Modal dialog for adding a new RE relation.
 * @module components/AddRelationModal
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import {
  INPUT_STYLE,
  LABEL_STYLE,
  FIELD_STYLE,
} from "../../constants/modalConstants.js";
import { ModalShell } from "./ModalShell.jsx";
import { sortElementIds } from "../../utils/stateUtils.js";

/**
 * @typedef {Object} AddRelationFormData
 * @property {string} from
 * @property {string} to
 * @property {'supports'|'conflicts'|'undermines'|'depends'} type
 * @property {string} explanation
 */

/**
 * Inline form fields for adding a relation — used by both AddRelationModal and the TextTab panel.
 *
 * @param {Object} props
 * @param {AddRelationFormData} props.form
 * @param {import('react').Dispatch<import('react').SetStateAction<AddRelationFormData>>} props.setForm
 * @param {REElement[]} props.elements - Non-withdrawn elements to choose from.
 */
export function AddRelationForm({ form, setForm, elements }) {
  /** @param {string} field @param {string} value */
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const ids = elements.map((e) => e.id);
  const selfLoop = form.from === form.to;
  return (
    <>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>From</label>
        <select
          value={form.from}
          onChange={(e) => set("from", e.target.value)}
          style={INPUT_STYLE}
        >
          {ids.sort(sortElementIds).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>To</label>
        <select
          value={form.to}
          onChange={(e) => set("to", e.target.value)}
          style={INPUT_STYLE}
        >
          {ids.sort(sortElementIds).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        {selfLoop && (
          <div style={{ fontSize: 10, color: C.conflicts, marginTop: 4 }}>
            From and To must be different.
          </div>
        )}
      </div>
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
          style={{ ...INPUT_STYLE, height: 80, resize: "vertical" }}
        />
      </div>
    </>
  );
}

/**
 * Modal for adding a new directed relation between two existing elements.
 *
 * @param {Object}      props
 * @param {REElement[]} props.elements - Non-withdrawn elements to choose from.
 * @param {number}      props.currentRound
 * @param {function(AddRelationFormData): void} props.onSave
 * @param {function(): void} props.onCancel
 * @returns {React.ReactElement}
 */
export function AddRelationModal({ elements, currentRound, onSave, onCancel }) {
  const ids = elements.map((e) => e.id);
  const [form, setForm] = useState(/** @type {AddRelationFormData} */ ({
    from: ids[0] ?? "",
    to: ids[1] ?? "",
    type: "supports",
    explanation: "",
  }));
  const selfLoop = form.from === form.to;
  return (
    <ModalShell
      title="Add relation"
      subtitle={`Will be added in Round ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() => onSave(form)}
      saveDisabled={!form.from || !form.to || selfLoop}
    >
      <AddRelationForm form={form} setForm={setForm} elements={elements} />
    </ModalShell>
  );
}
