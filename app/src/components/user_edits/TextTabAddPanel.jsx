/**
 * @fileoverview Bottom bar for adding elements and relations.
 * Spans the full width at ~20vh, always visible.
 * Also exports AddElementPanel and AddRelationPanel for use inside assist tabs.
 * @module components/TextTabAddPanel
 */

/** @import { REElement } from '../../types.js' */

import { useState, useEffect } from "react";

import { C } from "../../constants/colors.js";
import { sortElementIds } from "../../utils/stateUtils.js";

const ELEMENT_DEFAULTS = {
  type: "judgment",
  confidence: "moderate",
  origin: "user",
  text: "",
};

/**
 * @param {REElement[]} elements
 * @returns {{ from: string, to: string, type: string, explanation: string }}
 */
function makeRelationDefaults(elements) {
  const ids = elements.map((e) => e.id).sort(sortElementIds);
  return {
    from: ids[0] ?? "",
    to: ids[1] ?? "",
    type: "supports",
    explanation: "",
  };
}

const SELECT_STYLE = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.text,
  padding: "3px 6px",
  fontSize: 14,
  fontFamily: "inherit",
};

/**
 * @param {Object}      props
 * @param {REElement[]} props.elements   - Active (non-withdrawn) elements.
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 */
export function AddBar({ elements, onAddElement, onAddRelation, selected, ctrlTo }) {
  const [activeTab, setActiveTab] = useState("element");
  const [elementForm, setElementForm] = useState(ELEMENT_DEFAULTS);
  const [relationForm, setRelationForm] = useState(() =>
    makeRelationDefaults(elements),
  );

  useEffect(() => {
    if (!selected) return;
    setActiveTab("relation");
    setRelationForm((prev) => ({ ...prev, from: selected }));
  }, [selected]);

  useEffect(() => {
    if (!ctrlTo) return;
    setActiveTab("relation");
    setRelationForm((prev) => ({ ...prev, to: ctrlTo }));
  }, [ctrlTo]);

  const setEl = (field, value) =>
    setElementForm((prev) => ({ ...prev, [field]: value }));
  const setRel = (field, value) =>
    setRelationForm((prev) => ({ ...prev, [field]: value }));

  const ids = elements.map((e) => e.id).sort(sortElementIds);
  const isElementValid = elementForm.text.trim().length > 0;
  const isRelationValid =
    relationForm.from &&
    relationForm.to &&
    relationForm.from !== relationForm.to;
  const canSubmit = activeTab === "element" ? isElementValid : isRelationValid;

  const handleSubmit = () => {
    if (activeTab === "element") {
      onAddElement(elementForm);
      setElementForm(ELEMENT_DEFAULTS);
    } else {
      onAddRelation(relationForm);
      setRelationForm(makeRelationDefaults(elements));
    }
  };

  const tabBtn = (t) => ({
    padding: "2px 10px",
    borderRadius: 10,
    fontSize: 11,
    cursor: "pointer",
    border: `1px solid ${C.border}`,
    background: activeTab === t ? C.border : "transparent",
    color: activeTab === t ? C.text : C.dim,
    fontFamily: "inherit",
  });

  return (
    <div
      style={{
        minHeight: "20vh",
        flexShrink: 0,
        borderTop: `1px solid ${C.border}`,
        background: C.panel,
        display: "flex",
        flexDirection: "column",
        padding: "8px 16px",
      }}
    >
      {/* ── Controls row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            style={{
              marginLeft: "auto",
              padding: "3px 14px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: "bold",
              cursor: canSubmit ? "pointer" : "default",
              border: "none",
              background: C.supports,
              color: "#fff",
              opacity: canSubmit ? 1 : 0.4,
              fontFamily: "inherit",
            }}
          >
            Add {activeTab}
          </button>
          <button
            style={tabBtn("element")}
            onClick={() => setActiveTab("element")}
          >
            Element
          </button>
          <button
            style={tabBtn("relation")}
            onClick={() => setActiveTab("relation")}
          >
            Relation
          </button>
          <div
            style={{
              width: 1,
              height: 16,
              background: C.border,
              flexShrink: 0,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {activeTab === "element" ? (
            <>
              <select
                value={elementForm.type}
                onChange={(e) => setEl("type", e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="judgment">Judgment</option>
                <option value="principle">Principle</option>
                <option value="theory">Theory</option>
              </select>
              <select
                value={elementForm.confidence}
                onChange={(e) => setEl("confidence", e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
              <input
                value={elementForm.origin}
                onChange={(e) => setEl("origin", e.target.value)}
                placeholder="Origin"
                style={{ ...SELECT_STYLE, width: 90 }}
              />
            </>
          ) : (
            <>
              <select
                value={relationForm.from}
                onChange={(e) => setRel("from", e.target.value)}
                style={SELECT_STYLE}
              >
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <span style={{ color: C.dim, fontSize: 11, fontWeight: "bold" }}>
                →
              </span>
              <select
                value={relationForm.type}
                onChange={(e) => setRel("type", e.target.value)}
                style={{ ...SELECT_STYLE, color: C[relationForm.type] }}
              >
                <option value="supports">supports</option>
                <option value="conflicts">conflicts</option>
                <option value="undermines">undermines</option>
                <option value="depends">depends</option>
              </select>
              <span style={{ color: C.dim, fontSize: 11, fontWeight: "bold" }}>
                →
              </span>
              <select
                value={relationForm.to}
                onChange={(e) => setRel("to", e.target.value)}
                style={SELECT_STYLE}
              >
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              {relationForm.from === relationForm.to && ids.length >= 2 && (
                <span style={{ fontSize: 10, color: C.conflicts }}>
                  From ≠ To
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Text / explanation ── */}
      <textarea
        value={
          activeTab === "element" ? elementForm.text : relationForm.explanation
        }
        onChange={(e) =>
          activeTab === "element"
            ? setEl("text", e.target.value)
            : setRel("explanation", e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey && canSubmit) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={
          activeTab === "element"
            ? "Enter statement…"
            : "Explanation (optional)…"
        }
        style={{
          flex: 1,
          marginTop: 8,
          resize: "none",
          width: "100%",
          boxSizing: "border-box",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.text,
          padding: "6px 10px",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  );
}

const PANEL_STYLE = {
  flexShrink: 0,
  borderTop: `1px solid ${C.border}`,
  background: C.panel,
  display: "flex",
  flexDirection: "column",
  padding: "8px 16px",
  minHeight: "14vh",
};

/**
 * Minimal add-element panel for use inside an assist tab.
 * The element type is fixed.
 *
 * @param {Object}   props
 * @param {"judgment"|"principle"} props.elementType
 * @param {function} props.onAddElement
 */
export function AddElementPanel({ elementType, onAddElement }) {
  const [form, setForm] = useState({
    confidence: "moderate",
    origin: "user",
    text: "",
  });
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const canSubmit = form.text.trim().length > 0;
  const handleSubmit = () => {
    onAddElement({ type: elementType, ...form });
    setForm({ confidence: "moderate", origin: "user", text: "" });
  };
  return (
    <div style={PANEL_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          style={{
            padding: "3px 14px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: "bold",
            cursor: canSubmit ? "pointer" : "default",
            border: "none",
            background: C.supports,
            color: "#fff",
            opacity: canSubmit ? 1 : 0.4,
            fontFamily: "inherit",
          }}
        >
          Add {elementType}
        </button>
        <select
          value={form.confidence}
          onChange={(e) => set("confidence", e.target.value)}
          style={SELECT_STYLE}
        >
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>
        <input
          value={form.origin}
          onChange={(e) => set("origin", e.target.value)}
          placeholder="Origin"
          style={{ ...SELECT_STYLE, width: 90 }}
        />
      </div>
      <textarea
        value={form.text}
        onChange={(e) => set("text", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey && canSubmit) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Enter statement…"
        style={{
          flex: 1,
          marginTop: 8,
          resize: "none",
          width: "100%",
          boxSizing: "border-box",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.text,
          padding: "6px 10px",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  );
}

/**
 * Minimal add-relation panel for use inside the RelationSuggestTab.
 *
 * @param {Object}      props
 * @param {REElement[]} props.elements - Active (non-withdrawn) elements.
 * @param {function}    props.onAddRelation
 */
export function AddRelationPanel({ elements, onAddRelation }) {
  const [form, setForm] = useState(() => makeRelationDefaults(elements));
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const ids = elements.map((e) => e.id).sort(sortElementIds);
  const canSubmit = form.from && form.to && form.from !== form.to;
  const handleSubmit = () => {
    onAddRelation(form);
    setForm(makeRelationDefaults(elements));
  };
  return (
    <div style={PANEL_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          style={{
            padding: "3px 14px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: "bold",
            cursor: canSubmit ? "pointer" : "default",
            border: "none",
            background: C.supports,
            color: "#fff",
            opacity: canSubmit ? 1 : 0.4,
            fontFamily: "inherit",
          }}
        >
          Add relation
        </button>
        <select
          value={form.from}
          onChange={(e) => set("from", e.target.value)}
          style={SELECT_STYLE}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <span style={{ color: C.dim, fontSize: 11, fontWeight: "bold" }}>→</span>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          style={{ ...SELECT_STYLE, color: C[form.type] }}
        >
          <option value="supports">supports</option>
          <option value="conflicts">conflicts</option>
          <option value="undermines">undermines</option>
          <option value="depends">depends</option>
        </select>
        <span style={{ color: C.dim, fontSize: 11, fontWeight: "bold" }}>→</span>
        <select
          value={form.to}
          onChange={(e) => set("to", e.target.value)}
          style={SELECT_STYLE}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        {form.from === form.to && ids.length >= 2 && (
          <span style={{ fontSize: 10, color: C.conflicts }}>From ≠ To</span>
        )}
      </div>
      <textarea
        value={form.explanation}
        onChange={(e) => set("explanation", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey && canSubmit) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Explanation (optional)…"
        style={{
          flex: 1,
          marginTop: 8,
          resize: "none",
          width: "100%",
          boxSizing: "border-box",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.text,
          padding: "6px 10px",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  );
}
