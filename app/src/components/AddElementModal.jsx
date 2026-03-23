/**
 * @fileoverview Modal dialog for adding a new RE element.
 * @module components/AddElementModal
 */

import { useState } from "react";
import { ModalShell, INPUT_STYLE, LABEL_STYLE, FIELD_STYLE } from "./ModalShell.jsx";

/**
 * @typedef {Object} AddElementFormData
 * @property {'judgment'|'principle'|'theory'} type
 * @property {'high'|'moderate'|'low'}         confidence
 * @property {string} origin
 * @property {string} text
 */

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
/** Inline form fields for adding an element — used by both AddElementModal and the TextTab panel. */
export function AddElementForm({ form, setForm }) {
  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  return (
    <>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Type</label>
        <select value={form.type} onChange={e => set("type", e.target.value)} style={INPUT_STYLE}>
          <option value="judgment">Judgment</option>
          <option value="principle">Principle</option>
          <option value="theory">Background Theory</option>
        </select>
      </div>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Confidence</label>
        <select value={form.confidence} onChange={e => set("confidence", e.target.value)} style={INPUT_STYLE}>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Origin</label>
        <input type="text" value={form.origin} onChange={e => set("origin", e.target.value)} style={INPUT_STYLE} />
      </div>
      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>Text</label>
        <textarea value={form.text} onChange={e => set("text", e.target.value)}
          style={{ ...INPUT_STYLE, height: 90, resize: "vertical" }} />
      </div>
    </>
  );
}

export function AddElementModal({ initialType, currentRound, onSave, onCancel }) {
  const [form, setForm] = useState({ type: initialType, confidence: "moderate", origin: "user", text: "" });
  return (
    <ModalShell title="Add element" subtitle={`Will be added in Round ${currentRound + 1}`}
      onCancel={onCancel} onSave={() => onSave(form)} saveDisabled={!form.text.trim()}>
      <AddElementForm form={form} setForm={setForm} />
    </ModalShell>
  );
}
