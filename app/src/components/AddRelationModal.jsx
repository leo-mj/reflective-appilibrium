/**
 * @fileoverview Modal dialog for adding a new RE relation.
 * @module components/AddRelationModal
 */

import { useState } from "react";
import { C } from "../constants/colors.js";

/**
 * @typedef {Object} AddRelationFormData
 * @property {string} from
 * @property {string} to
 * @property {'supports'|'conflicts'|'undermines'|'depends'} type
 * @property {string} explanation
 */

/**
 * Centred modal overlay for adding a new relation between two existing elements.
 *
 * @param {Object}      props
 * @param {import('../types.js').REElement[]} props.elements - All visible elements to choose from.
 * @param {number}      props.currentRound
 * @param {function(AddRelationFormData): void} props.onSave
 * @param {function(): void} props.onCancel
 * @returns {React.ReactElement}
 */
export function AddRelationModal({ elements, currentRound, onSave, onCancel }) {
  const ids = elements.map(e => e.id);
  const [form, setForm] = useState({
    from:        ids[0] ?? "",
    to:          ids[1] ?? "",
    type:        "supports",
    explanation: "",
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const inputStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
    color: C.text, padding: "6px 10px", fontSize: 12, width: "100%",
    boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle = { fontSize: 11, color: C.dim, display: "block", marginBottom: 4 };
  const fieldStyle = { marginBottom: 16 };

  const canSave = form.from && form.to && form.from !== form.to;

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
          Add relation
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>
          Will be added in Round {currentRound + 1}
        </div>

        {/* ── From ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>From</label>
          <select value={form.from} onChange={e => set("from", e.target.value)} style={inputStyle}>
            {ids.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>

        {/* ── To ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>To</label>
          <select value={form.to} onChange={e => set("to", e.target.value)} style={inputStyle}>
            {ids.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          {form.from === form.to && (
            <div style={{ fontSize: 10, color: C.conflicts, marginTop: 4 }}>From and To must be different.</div>
          )}
        </div>

        {/* ── Relation type ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Relation type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)} style={inputStyle}>
            <option value="supports">Supports</option>
            <option value="conflicts">Conflicts</option>
            <option value="undermines">Undermines</option>
            <option value="depends">Depends</option>
          </select>
        </div>

        {/* ── Explanation ── */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Explanation</label>
          <textarea
            value={form.explanation}
            onChange={e => set("explanation", e.target.value)}
            style={{ ...inputStyle, height: 90, resize: "vertical" }}
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
          <button onClick={() => onSave(form)} disabled={!canSave} style={{
            padding: "7px 18px", borderRadius: 4, border: "none",
            background: canSave ? C.supports : C.border,
            color: "#fff", cursor: canSave ? "pointer" : "default",
            fontSize: 12, fontWeight: "bold",
          }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
