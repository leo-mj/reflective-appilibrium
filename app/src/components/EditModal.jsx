/**
 * @fileoverview Modal dialog for editing a single RE element.
 * @module components/EditModal
 */

/** @import { REElement } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";

/**
 * @typedef {Object} EditFormData
 * @property {'judgment'|'principle'|'theory'} type
 * @property {'high'|'moderate'|'low'}         confidence
 * @property {string} origin
 * @property {string} text
 */

/**
 * Centred modal overlay for editing all user-facing properties of an RE element.
 *
 * On save the parent is responsible for:
 * - Incrementing `state.round`
 * - Updating the element in `state.elements` with the returned form data
 * - Setting the appropriate round fields (`revisedRound`, `withdrawnRound`, etc.)
 * - Adding a log entry
 *
 * The modal is opened by double-clicking a node in the Graph tab or an ID badge
 * in the Text panel.  Pressing Cancel or clicking the backdrop closes it without
 * any state change.
 *
 * @param {Object}    props
 * @param {REElement} props.element       - The element to edit (read-only initial values).
 * @param {number}    props.currentRound  - The current round number; displayed as "save as Round N+1".
 * @param {function(EditFormData): void} props.onSave   - Called with the updated form data on save.
 * @param {function(): void}             props.onCancel - Called when the user cancels.
 * @returns {React.ReactElement}
 */
export function EditModal({ element, currentRound, onSave, onCancel }) {
  const [form, setForm] = useState({
    type:       element.type,
    confidence: element.confidence,
    origin:     element.origin,
    text:       element.text,
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const inputStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
    color: C.text, padding: "6px 10px", fontSize: 12, width: "100%",
    boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 11, color: C.dim, display: "block", marginBottom: 4 };
  const fieldStyle = { marginBottom: 16 };

  return (
    // Backdrop — clicking it cancels.
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
      }}
    >
      {/* Modal box — stopPropagation so clicks inside don't hit the backdrop. */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 28, width: 500, maxWidth: "92vw", maxHeight: "88vh",
          overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: "bold", color: C.text, marginBottom: 4 }}>
          Revise {element.id}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>
          Saving will mark this element as revised and create Round {currentRound + 1}
        </div>

        {/* ── Type ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)} style={inputStyle}>
            <option value="judgment">Judgment</option>
            <option value="principle">Principle</option>
            <option value="theory">Background Theory</option>
          </select>
        </div>

        {/* ── Confidence ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Confidence</label>
          <select value={form.confidence} onChange={e => set("confidence", e.target.value)} style={inputStyle}>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* ── Origin ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Origin</label>
          <input
            type="text"
            value={form.origin}
            onChange={e => set("origin", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* ── Text ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Text</label>
          <textarea
            value={form.text}
            onChange={e => set("text", e.target.value)}
            style={{ ...inputStyle, height: 110, resize: "vertical" }}
          />
        </div>

        {/* ── Buttons ── */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onCancel} style={{
            padding: "7px 18px", borderRadius: 4, border: `1px solid ${C.border}`,
            background: "transparent", color: C.dim, cursor: "pointer", fontSize: 12,
          }}>
            Cancel
          </button>
          <button onClick={() => onSave(form)} style={{
            padding: "7px 18px", borderRadius: 4, border: "none",
            background: C.supports, color: "#fff", cursor: "pointer",
            fontSize: 12, fontWeight: "bold",
          }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
