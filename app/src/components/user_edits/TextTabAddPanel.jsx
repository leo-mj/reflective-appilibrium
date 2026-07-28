/**
 * @fileoverview Bottom bar for adding elements and relations.
 * Spans the full width at ~20vh, always visible.
 * Workflow-tab panels (AddElementPanel, AddArgumentPanel, AddRelationPanel)
 * live in WorkflowAddPanels.jsx.
 * @module components/TextTabAddPanel
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";

import { C } from "../../constants/colors.js";
import { sortElementIds } from "../../utils/stateUtils.js";
import { SELECT_STYLE, makeRelationDefaults } from "./addPanelShared.js";

const ELEMENT_DEFAULTS = {
  type: "judgment",
  confidence: 0.67,
  origin: "user",
  text: "",
};

/**
 * @param {Object}      props
 * @param {REElement[]} props.elements   - Active (non-withdrawn) elements.
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 */
export function AddBar({
  elements,
  onAddElement,
  onAddRelation,
  selected,
  ctrlTo,
}) {
  const [activeTab, setActiveTab] = useState("element");
  const [elementForm, setElementForm] = useState(ELEMENT_DEFAULTS);
  const [relationForm, setRelationForm] = useState(() =>
    makeRelationDefaults(elements),
  );

  // Selecting a node in the graph, or ctrl-selecting a second one, pre-fills the
  // relation form. This adjusts state during render rather than in an effect so
  // the panel never paints a frame showing the stale tab, and so a selection
  // that arrives on mount is picked up the same way as a later one — hence the
  // trackers start at null rather than at the current prop.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevSelected, setPrevSelected] = useState(null);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected) {
      setActiveTab("relation");
      setRelationForm((prev) => ({ ...prev, from: selected }));
    }
  }

  const [prevCtrlTo, setPrevCtrlTo] = useState(null);
  if (ctrlTo !== prevCtrlTo) {
    setPrevCtrlTo(ctrlTo);
    if (ctrlTo) {
      setActiveTab("relation");
      setRelationForm((prev) => ({ ...prev, to: ctrlTo }));
    }
  }

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
              {[
                { l: "L", v: 0.33 },
                { l: "M", v: 0.67 },
                { l: "H", v: 1.0 },
              ].map(({ l, v }) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setEl("confidence", v)}
                  style={{
                    ...SELECT_STYLE,
                    padding: "3px 7px",
                    background:
                      Math.abs(elementForm.confidence - v) < 0.01
                        ? C.border
                        : "transparent",
                    fontWeight:
                      Math.abs(elementForm.confidence - v) < 0.01
                        ? "bold"
                        : "normal",
                    cursor: "pointer",
                  }}
                >
                  {l}
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={elementForm.confidence}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v))
                    setEl("confidence", Math.max(0, Math.min(1, v)));
                }}
                style={{ ...SELECT_STYLE, width: 55 }}
              />
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
                <option value="depends">depends on</option>
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
          outline: "none",
        }}
      />
    </div>
  );
}

