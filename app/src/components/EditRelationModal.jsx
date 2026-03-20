/**
 * @fileoverview Modal dialog for editing a single RE relation.
 * @module components/EditRelationModal
 */

/** @import { RERelation } from '../types.js' */

import { useState } from "react";
import { C } from "../constants/colors.js";

/**
 * @typedef {Object} EditRelationFormData
 * @property {'supports'|'conflicts'|'undermines'|'depends'} type
 * @property {string} explanation
 */

/**
 * Centred modal overlay for editing the type and explanation of an RE relation.
 * The `from` and `to` endpoints are displayed as read-only since changing them
 * would alter the identity of the relation itself.
 *
 * Saving increments the round in the parent (see {@link module:components/REState}).
 *
 * @param {Object}      props
 * @param {RERelation}  props.relation      - The relation to edit (read-only initial values).
 * @param {number}      props.currentRound  - Current round; displayed as "save as Round N+1".
 * @param {function(EditRelationFormData): void} props.onSave   - Called with updated form data on save.
 * @param {function(): void}                     props.onCancel - Called on cancel.
 * @returns {React.ReactElement}
 */
export function EditRelationModal({ relation, currentRound, onSave, onCancel }) {
  const [form, setForm] = useState({
    type:        relation.type,
    explanation: relation.explanation,
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
          Edit relation
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>
          {relation.from} → {relation.to} · Saving will create Round {currentRound + 1}
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
            Save as Round {currentRound + 1}
          </button>
        </div>
      </div>
    </div>
  );
}
