/**
 * @fileoverview Modal dialog for adding a new RE relation.
 * @module components/AddRelationModal
 */

/** @import { REElement } from '../../types.js' */

import { useState, useEffect } from "react";
import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { ElementOptions } from "./ElementOptions.jsx";
import { RelationTypeOptions } from "./RelationTypeOptions.jsx";

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
  const selfLoop = form.from === form.to;
  return (
    <>
      <FormField label="From">
        <select
          value={form.from}
          onChange={(e) => set("from", e.target.value)}
          style={INPUT_STYLE}
        >
          <ElementOptions elements={elements} />
        </select>
      </FormField>
      <FormField label="To">
        <select
          value={form.to}
          onChange={(e) => set("to", e.target.value)}
          style={INPUT_STYLE}
        >
          <ElementOptions elements={elements} />
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
          <RelationTypeOptions capitalized />
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
  draft,
  onDraftChange,
}) {
  const ids = elements.map((e) => e.id);
  const defaults = () =>
    /** @type {AddRelationFormData} */ ({
      from: initialFrom ?? ids[0] ?? "",
      to: initialTo ?? ids[1] ?? "",
      type: "supports",
      explanation: "",
    });
  const [form, setForm] = useState(() => ({
    ...defaults(),
    ...draft,
    // A graph selection is a fresh instruction and outranks the draft's ends;
    // where nothing was selected, the draft keeps whatever it was left on.
    ...(initialFrom ? { from: initialFrom } : null),
    ...(initialTo ? { to: initialTo } : null),
  }));
  useEffect(() => {
    onDraftChange?.(form);
  }, [form, onDraftChange]);

  const selfLoop = form.from === form.to;
  return (
    <ModalShell
      title="Add relation"
      subtitle={`Will be added in Round ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() => onSave(form)}
      onClear={() => setForm(defaults())}
      saveDisabled={!form.from || !form.to || selfLoop}
    >
      <AddRelationForm form={form} setForm={setForm} elements={elements} />
    </ModalShell>
  );
}
