/**
 * @fileoverview Modal dialog for adding a new RE element.
 * @module components/AddElementModal
 */

import { useState } from "react";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { ConfidenceInput } from "./ConfidenceInput.jsx";

/**
 * @typedef {Object} AddElementFormData
 * @property {'judgment'|'principle'|'theory'} type
 * @property {number} confidence
 * @property {string} origin
 * @property {string} text
 */

/**
 * Inline form fields for adding an element — used by both AddElementModal and the TextTab panel.
 *
 * @param {Object} props
 * @param {AddElementFormData} props.form
 * @param {import('react').Dispatch<import('react').SetStateAction<AddElementFormData>>} props.setForm
 */
export function AddElementForm({ form, setForm }) {
  /** @param {string} field @param {string} value */
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  return (
    <>
      <FormField label="Type">
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          style={INPUT_STYLE}
        >
          <option value="judgment">Judgment</option>
          <option value="principle">Principle</option>
          <option value="theory">Background Theory</option>
        </select>
      </FormField>
      <ConfidenceInput
        value={form.confidence}
        onChange={(v) => set("confidence", v)}
      />
      <FormField label="Origin">
        <input
          type="text"
          value={form.origin}
          onChange={(e) => set("origin", e.target.value)}
          style={INPUT_STYLE}
        />
      </FormField>
      <FormField label="Text">
        <textarea
          value={form.text}
          onChange={(e) => set("text", e.target.value)}
          style={{ ...INPUT_STYLE, height: 90, resize: "vertical" }}
        />
      </FormField>
    </>
  );
}

/**
 * Modal for adding a new RE element.
 * The element ID is assigned automatically by the parent on save.
 *
 * @param {Object}   props
 * @param {'judgment'|'principle'|'theory'} props.initialType - Pre-selected element type.
 * @param {number}   props.currentRound
 * @param {function(AddElementFormData): void} props.onSave
 * @param {function(): void} props.onCancel
 * @returns {React.ReactElement}
 */
export function AddElementModal({
  initialType,
  currentRound,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(
    /** @type {AddElementFormData} */ ({
      type: initialType,
      confidence: 0.67,
      origin: "user",
      text: "",
    }),
  );
  return (
    <ModalShell
      title="Add element"
      subtitle={`Will be added in Round ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() => onSave(form)}
      saveDisabled={!form.text.trim()}
    >
      <AddElementForm form={form} setForm={setForm} />
    </ModalShell>
  );
}
