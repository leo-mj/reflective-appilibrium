/**
 * @fileoverview Modal dialog for adding a new RE element.
 * @module components/AddElementModal
 */

import { useState } from "react";
import { C } from "../constants/colors.js";

/**
 * @typedef {Object} AddElementFormData
 * @property {'judgment'|'principle'|'theory'} type
 * @property {'high'|'moderate'|'low'}         confidence
 * @property {string} origin
 * @property {string} text
 */

/**
 * Centred modal overlay for adding a new RE element.
 * The element ID is assigned automatically by the parent on save.
 *
 * @param {Object}   props
 * @param {'judgment'|'principle'|'theory'} props.initialType - Pre-selected element type.
 * @param {number}   props.currentRound - Current round number.
 * @param {function(AddElementFormData): void} props.onSave
 * @param {function(): void} props.onCancel
 * @returns {React.ReactElement}
 */
export function AddElementModal({ initialType, currentRound, onSave, onCancel }) {
  const [form, setForm] = useState({
    type:       initialType,
    confidence: "moderate",
    origin:     "user",
    text:       "",
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
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 28, width: 500, maxWidth: "92vw", maxHeight: "88vh",
          overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: "bold", color: C.text, marginBottom: 4 }}>
          Add element
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>
          Will be added in Round {currentRound + 1}
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
          <button onClick={() => onSave(form)} disabled={!form.text.trim()} style={{
            padding: "7px 18px", borderRadius: 4, border: "none",
            background: form.text.trim() ? C.supports : C.border,
            color: "#fff", cursor: form.text.trim() ? "pointer" : "default",
            fontSize: 12, fontWeight: "bold",
          }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
