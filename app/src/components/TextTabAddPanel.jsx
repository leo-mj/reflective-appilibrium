/**
 * @fileoverview Add-element / add-relation panel shown at the top of TextTab.
 * Manages its own form state; calls parent callbacks on submit.
 * @module components/TextTabAddPanel
 */

import { useState } from "react";
import { C } from "../constants/colors.js";
import { AddElementForm } from "./AddElementModal.jsx";
import { AddRelationForm } from "./AddRelationModal.jsx";

const ELEMENT_DEFAULTS = {
  type: "judgment",
  confidence: "moderate",
  origin: "user",
  text: "",
};

function makeRelationDefaults(elements) {
  const ids = elements.map((e) => e.id);
  return { from: ids[0] ?? "", to: ids[1] ?? "", type: "supports", explanation: "" };
}

/**
 * @param {Object}      props
 * @param {string|null} props.forceType  - When set, switches form to "element" with this type.
 * @param {boolean}     props.forceRelation - When true, switches form to "relation".
 * @param {REElement[]} props.elements   - Active (non-withdrawn) elements for the relation picker.
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 */
export function AddPanel({ activeTab, setActiveTab, elements, onAddElement, onAddRelation }) {
  const [elementForm, setElementForm] = useState(ELEMENT_DEFAULTS);
  const [relationForm, setRelationForm] = useState(() => makeRelationDefaults(elements));

  return (
    <div style={{ marginBottom: 12, padding: "10px 10px 12px", borderRadius: 8, background: C.panel, border: `1px solid ${C.border}` }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {["element", "relation"].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              flex: 1, padding: "4px 0", borderRadius: 4, cursor: "pointer", fontSize: 12,
              border: `1px solid ${C.border}`,
              background: activeTab === t ? C.border : "transparent",
              color: activeTab === t ? C.text : C.dim,
            }}
          >
            {t === "element" ? "Element" : "Relation"}
          </button>
        ))}
      </div>

      {activeTab === "element" ? (
        <AddElementForm form={elementForm} setForm={setElementForm} />
      ) : (
        <AddRelationForm form={relationForm} setForm={setRelationForm} elements={elements} />
      )}

      <button
        disabled={
          activeTab === "element"
            ? !elementForm.text.trim()
            : !relationForm.from || !relationForm.to || relationForm.from === relationForm.to
        }
        onClick={() => {
          if (activeTab === "element") {
            onAddElement(elementForm);
            setElementForm(ELEMENT_DEFAULTS);
          } else {
            onAddRelation(relationForm);
            setRelationForm(makeRelationDefaults(elements));
          }
        }}
        style={{
          width: "100%", marginTop: 4, padding: "6px 0", borderRadius: 4,
          border: "none", cursor: "pointer", fontSize: 12, fontWeight: "bold",
          background: C.supports, color: "#fff",
        }}
      >
        Add {activeTab}
      </button>
    </div>
  );
}
