/**
 * @fileoverview Modal dialog for adding a new RE relation.
 * @module components/AddRelationModal
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { sortElementIds } from "../../utils/stateUtils.js";

/**
 * @typedef {Object} AddRelationFormData
 * @property {string} from
 * @property {string} to
 * @property {'supports'|'conflicts'|'undermines'|'depends'|'entails'|'precludes'} type
 * @property {string} explanation
 */

/**
 * Inline form fields for adding a relation — used by both AddRelationModal and the TextTab panel.
 *
 * @param {Object} props
 * @param {AddRelationFormData} props.form
 * @param {import('react').Dispatch<import('react').SetStateAction<AddRelationFormData>>} props.setForm
 * @param {REElement[]} props.elements - Elements to choose from; may include withdrawn ones.
 */
export function AddRelationForm({ form, setForm, elements }) {
  /** @param {string} field @param {string} value */
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const ids = elements.map((e) => e.id);
  const selfLoop = form.from === form.to;
  return (
    <>
      <FormField label="From">
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
      </FormField>
      <FormField label="To">
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
      </FormField>
      <FormField label="Relation type">
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          style={INPUT_STYLE}
        >
          <optgroup label="Dialectical">
            <option value="supports">Supports</option>
            <option value="conflicts">Conflicts</option>
            <option value="undermines">Undermines</option>
            <option value="depends">Depends on</option>
          </optgroup>
          {/* A binary form can only express a one-premise argument; the joint
              variants need the argument panel. */}
          <optgroup label="Argument">
            <option value="entails">Entails</option>
            <option value="precludes">Precludes</option>
          </optgroup>
        </select>
      </FormField>
      <FormField label="Explanation">
        <textarea
          value={form.explanation}
          onChange={(e) => set("explanation", e.target.value)}
          style={{ ...INPUT_STYLE, height: 80, resize: "vertical" }}
        />
      </FormField>
    </>
  );
}

/**
 * Modal for adding a new directed relation between two existing elements.
 *
 * @param {Object}      props
 * @param {REElement[]} props.elements - Elements to choose from; may include withdrawn ones.
 * @param {number}      props.currentRound
 * @param {function(AddRelationFormData): void} props.onSave
 * @param {function(): void} props.onCancel
 * @param {string}      [props.initialFrom] - Pre-fill the From field.
 * @param {string}      [props.initialTo]   - Pre-fill the To field.
 * @returns {React.ReactElement}
 */
export function AddRelationModal({
  elements,
  currentRound,
  onSave,
  onCancel,
  initialFrom,
  initialTo,
}) {
  const ids = elements.map((e) => e.id);
  const [form, setForm] = useState(
    /** @type {AddRelationFormData} */ ({
      from: initialFrom ?? ids[0] ?? "",
      to: initialTo ?? ids[1] ?? "",
      type: "supports",
      explanation: "",
    }),
  );
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
