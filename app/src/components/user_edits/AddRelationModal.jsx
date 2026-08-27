/**
 * @fileoverview Modal dialog for adding a new RE relation.
 * @module components/AddRelationModal
 */

/** @import { REElement } from '../../types.js' */

import { useState, useEffect } from "react";
import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { Dropdown } from "./Dropdown.jsx";
import { elementOptions } from "./ElementOptions.jsx";
import { relationTypeOptions } from "./RelationTypeOptions.jsx";

/** Title-cased here, to match the modal's own wording. */
const RELATION_ROWS = relationTypeOptions({ capitalized: true });

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
  const rows = elementOptions(elements);
  return (
    <>
      <FormField label="From">
        <Dropdown
          label="From"
          value={form.from}
          onChange={(v) => set("from", v)}
          options={rows}
          style={INPUT_STYLE}
          layout={{ width: "100%" }}
        />
      </FormField>
      <FormField label="To">
        <Dropdown
          label="To"
          value={form.to}
          onChange={(v) => set("to", v)}
          options={rows}
          style={INPUT_STYLE}
          layout={{ width: "100%" }}
        />
        {selfLoop && (
          <div style={{ fontSize: 10, color: C.conflicts, marginTop: 4 }}>
            From and To must be different.
          </div>
        )}
      </FormField>
      <FormField label="Relation type">
        <Dropdown
          label="Relation type"
          value={form.type}
          onChange={(v) => set("type", v)}
          options={RELATION_ROWS}
          style={INPUT_STYLE}
          layout={{ width: "100%" }}
        />
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
