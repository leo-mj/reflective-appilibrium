/**
 * @fileoverview Modal dialog for revising a single RE element.
 * @module components/EditModal
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { ConfidenceInput } from "./ConfidenceInput.jsx";

/**
 * @typedef {Object} EditFormData
 * @property {'judgment'|'principle'|'theory'} type
 * @property {number} confidence
 * @property {string} origin
 * @property {string} text
 */

/**
 * Modal for revising all user-facing properties of an RE element.
 * Saving always sets the element's status to `"revised"`.
 *
 * @param {Object}    props
 * @param {REElement} props.element       - The element to revise (read-only initial values).
 * @param {number}    props.currentRound  - Current round; informs the subtitle.
 * @param {function(EditFormData): void} props.onSave
 * @param {function(): void}             props.onCancel
 * @returns {React.ReactElement}
 */
export function EditModal({ element, currentRound, onSave, onCancel }) {
  const [form, setForm] = useState({
    type: element.type,
    confidence: element.confidence,
    origin: element.origin,
    text: element.text,
  });

  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <ModalShell
      title={`Revise ${element.id}`}
      subtitle={`Saving will mark this element as revised and create Round ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() => onSave(form)}
    >
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
          style={{ ...INPUT_STYLE, height: 110, resize: "vertical" }}
        />
      </FormField>
    </ModalShell>
  );
}
