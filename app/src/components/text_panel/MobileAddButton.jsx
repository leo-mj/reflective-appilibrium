/**
 * @fileoverview Floating action button (mobile) for adding elements and relations.
 * @module components/text_panel/MobileAddButton
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { AddElementModal } from "../user_edits/AddElementModal.jsx";
import { AddRelationModal } from "../user_edits/AddRelationModal.jsx";

/**
 * @param {Object}   props
 * @param {function} props.onAddElement
 * @param {function} props.onAddRelation
 * @param {Array}    props.elements    - Full element list (filtering applied internally).
 * @param {number}   props.round       - Current round number.
 */
export function MobileAddButton({ onAddElement, onAddRelation, elements, round }) {
  const [addMenu, setAddMenu] = useState(false);
  const [adding, setAdding] = useState(null); // 'element' | 'relation' | null

  return (
    <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 99 }}>
      {addMenu && (
        <div
          style={{
            position: "absolute",
            bottom: 44,
            right: 0,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {[
            ["element", "Element"],
            ["relation", "Relation"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setAdding(key);
                setAddMenu(false);
              }}
              style={{
                background: "transparent",
                border: "none",
                borderBottom:
                  key === "element" ? `1px solid ${C.border}` : "none",
                color: C.text,
                cursor: "pointer",
                fontSize: 13,
                padding: "10px 18px",
                textAlign: "left",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setAddMenu((m) => !m)}
        style={{
          background: C.supports,
          border: "none",
          borderRadius: 6,
          color: "#fff",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </button>

      {adding === "element" && (
        <AddElementModal
          initialType="judgment"
          currentRound={round}
          onSave={(formData) => {
            onAddElement(formData);
            setAdding(null);
          }}
          onCancel={() => setAdding(null)}
        />
      )}
      {adding === "relation" && (
        <AddRelationModal
          elements={elements.filter(
            (e) => e.status !== "withdrawn" && e.status !== "rejected",
          )}
          currentRound={round}
          onSave={(formData) => {
            onAddRelation(formData);
            setAdding(null);
          }}
          onCancel={() => setAdding(null)}
        />
      )}
    </div>
  );
}
