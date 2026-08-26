/**
 * @fileoverview Modal dialog for adding a new RE element.
 * @module components/AddElementModal
 */

import { useState, useEffect } from "react";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import {
  lastOrigin,
  originOrDefault,
  setLastOrigin,
} from "../../utils/lastOrigin.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { ConfidenceInput } from "./ConfidenceInput.jsx";

/**
 * The origin is whatever the reader last filled the field in with, here and in
 * the two add panels alike — see {@link module:utils/lastOrigin}. Clear puts the
 * form back to these, and so leaves it standing rather than blanking it: it is
 * who is adding, not part of the element being written.
 *
 * @param {'judgment'|'principle'|'theory'} type
 */
const defaults = (type) => ({
  type,
  confidence: 0.67,
  origin: lastOrigin(),
  text: "",
});

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
          // Reported outward as well as kept here, so the next form to open on
          // any surface starts where this one was left.
          onChange={(e) => {
            set("origin", e.target.value);
            setLastOrigin(e.target.value);
          }}
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
 * @param {AddElementFormData} [props.draft] - What was in the form when it was
 *   last closed. Closing is not discarding: a modal is easy to dismiss by
 *   accident, and half-written text is worth more than a clean slate.
 * @param {function(AddElementFormData): void} [props.onDraftChange] - Reports
 *   the form outward so it survives this component being unmounted.
 * @returns {React.ReactElement}
 */
export function AddElementModal({
  initialType,
  currentRound,
  onSave,
  onCancel,
  draft,
  onDraftChange,
}) {
  const [form, setForm] = useState(
    // The type comes from the button that opened this — that is a fresh choice,
    // so it wins over whatever type the draft was left on.
    /** @type {AddElementFormData} */ ({
      ...defaults(initialType),
      ...draft,
      type: initialType,
    }),
  );
  useEffect(() => {
    onDraftChange?.(form);
  }, [form, onDraftChange]);

  return (
    <ModalShell
      title="Add element"
      subtitle={`Will be added in Round ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() => onSave({ ...form, origin: originOrDefault(form.origin) })}
      onClear={() => setForm(defaults(initialType))}
      saveDisabled={!form.text.trim()}
    >
      <AddElementForm form={form} setForm={setForm} />
    </ModalShell>
  );
}
