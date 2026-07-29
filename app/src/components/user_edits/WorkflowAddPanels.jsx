/**
 * @fileoverview Add panels for use inside workflow (assist) tabs.
 * AddElementPanel, AddArgumentPanel, and AddRelationPanel each render
 * a compact bottom panel for adding a single element or relation type.
 * @module components/WorkflowAddPanels
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";

import { C } from "../../constants/colors.js";
import {
  sortElementIds,
  defaultPickerIds,
  newArgumentId,
} from "../../utils/stateUtils.js";
import { Tooltip } from "../Tooltip.jsx";
import { ElementOptions } from "./ElementOptions.jsx";
import { RelationTypeOptions } from "./RelationTypeOptions.jsx";
import { SELECT_STYLE, PANEL_STYLE, makeRelationDefaults } from "./addPanelShared.js";


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
    confidence: 0.67,
    origin: "user",
    text: "",
  });
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const canSubmit = form.text.trim().length > 0;
  const handleSubmit = () => {
    onAddElement({ type: elementType, ...form });
    setForm({ confidence: 0.67, origin: "user", text: "" });
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
          }}
        >
          Add {elementType}
        </button>
        {[
          { l: "L", v: 0.33 },
          { l: "M", v: 0.67 },
          { l: "H", v: 1.0 },
        ].map(({ l, v }) => (
          <button
            key={l}
            type="button"
            onClick={() => set("confidence", v)}
            style={{
              ...SELECT_STYLE,
              padding: "3px 7px",
              background:
                Math.abs(form.confidence - v) < 0.01 ? C.border : "transparent",
              fontWeight:
                Math.abs(form.confidence - v) < 0.01 ? "bold" : "normal",
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
          value={form.confidence}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v))
              set("confidence", Math.max(0, Math.min(1, v)));
          }}
          style={{ ...SELECT_STYLE, width: 55 }}
        />
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
          outline: "none",
        }}
      />
    </div>
  );
}

/**
 * Persistent bottom panel for manually adding a jointly_entails argument.
 *
 * @param {Object}      props
 * @param {REElement[]} props.elements - Elements that may be referenced; see linkableElements.
 * @param {function}    props.onAddRelation
 */
export function AddArgumentPanel({ elements, onAddRelation }) {
  const ids = elements.map((e) => e.id).sort(sortElementIds);
  // Any linkable element can be picked, but the form opens on ones in play.
  const seed = defaultPickerIds(elements);
  const [premises, setPremises] = useState([seed[0] ?? ""]);
  const [conclusion, setConclusion] = useState(seed[1] ?? seed[0] ?? "");
  const [explanation, setExplanation] = useState("");
  const [mode, setMode] = useState("entails"); // "entails" | "precludes"

  const setPremise = (i, id) =>
    setPremises((prev) => prev.map((p, j) => (j === i ? id : p)));
  const addPremise = () =>
    setPremises((prev) => {
      // Prefer an unused in-play element, but fall back to the full pool: with
      // few elements in play the only free one may be withdrawn or rejected,
      // and appending a duplicate would just disable the submit button.
      const taken = new Set([...prev, conclusion]);
      const free = (list) => list.find((id) => !taken.has(id));
      return [...prev, free(seed) ?? free(ids) ?? ""];
    });
  const removePremise = (i) =>
    setPremises((prev) => prev.filter((_, j) => j !== i));

  const premiseSet = new Set(premises);
  const hasDuplicates = premiseSet.size < premises.length;
  const conclusionClash = premiseSet.has(conclusion);
  const canSubmit =
    premises.length >= 1 &&
    !!conclusion &&
    premises.every(Boolean) &&
    !hasDuplicates &&
    !conclusionClash;

  const relationType =
    mode === "entails"
      ? premises.length === 1
        ? "entails"
        : "jointly_entails"
      : premises.length === 1
        ? "precludes"
        : "jointly_precludes";

  const handleSubmit = () => {
    const argumentId = newArgumentId();
    premises.forEach((premise, i) => {
      onAddRelation(
        {
          from: premise,
          to: conclusion,
          type: relationType,
          argumentId,
          explanation,
        },
        { select: false, pinRecent: i === premises.length - 1 },
      );
    });
    setPremises([seed[0] ?? ""]);
    setConclusion(seed[1] ?? seed[0] ?? "");
    setExplanation("");
  };

  const ghostBtn = {
    background: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.dim,
    fontSize: 11,
    padding: "1px 6px",
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <div style={PANEL_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
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
            background: mode === "entails" ? C.jointly_entails : C.jointly_precludes,
            color: "#fff",
            opacity: canSubmit ? 1 : 0.4,
            flexShrink: 0,
            alignSelf: "center",
          }}
        >
          Add argument
        </button>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 4,
            alignItems: "center",
          }}
        >
          {premises.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 4 }}>
              <select
                value={p}
                onChange={(e) => setPremise(i, e.target.value)}
                style={SELECT_STYLE}
              >
                <ElementOptions elements={elements} />
              </select>
              {premises.length > 1 && (
                <button onClick={() => removePremise(i)} style={ghostBtn}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addPremise}
            disabled={ids.length <= premises.length + 1}
            style={{ ...ghostBtn, padding: "1px 8px" }}
          >
            + premise
          </button>
          {(hasDuplicates || conclusionClash) && (
            <span style={{ fontSize: 10, color: C.conflicts }}>
              {hasDuplicates
                ? "Premises must be distinct."
                : "Premise = conclusion."}
            </span>
          )}
        </div>

        <Tooltip text="Click to switch between entails and precludes">
          <button
            type="button"
            onClick={() => setMode((m) => (m === "entails" ? "precludes" : "entails"))}
            style={{
              background: "transparent",
              border: `1px solid ${mode === "entails" ? C.jointly_entails : C.jointly_precludes}`,
              borderRadius: 4,
              color: mode === "entails" ? C.jointly_entails : C.jointly_precludes,
              fontSize: 11,
              fontWeight: "bold",
              padding: "2px 6px",
              cursor: "pointer",
              alignSelf: "center",
              flexShrink: 0,
            }}
          >
            {mode === "entails" ? "(jointly) entails →" : "(jointly) precludes →"}
          </button>
        </Tooltip>

        <select
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          style={{ ...SELECT_STYLE, alignSelf: "center" }}
        >
          <ElementOptions elements={elements} />
        </select>
      </div>
      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
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
 * @param {REElement[]} props.elements - Elements that may be referenced; see linkableElements.
 * @param {function}    props.onAddRelation
 */
export function AddRelationPanel({ elements, onAddRelation }) {
  const [form, setForm] = useState(() => makeRelationDefaults(elements));
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
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
          }}
        >
          Add relation
        </button>
        <select
          value={form.from}
          onChange={(e) => set("from", e.target.value)}
          style={SELECT_STYLE}
        >
          <ElementOptions elements={elements} />
        </select>
        <span style={{ color: C.dim, fontSize: 11, fontWeight: "bold" }}>
          →
        </span>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value)}
          style={{ ...SELECT_STYLE, color: C[form.type] }}
        >
          <RelationTypeOptions />
        </select>
        <span style={{ color: C.dim, fontSize: 11, fontWeight: "bold" }}>
          →
        </span>
        <select
          value={form.to}
          onChange={(e) => set("to", e.target.value)}
          style={SELECT_STYLE}
        >
          <ElementOptions elements={elements} />
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
          outline: "none",
        }}
      />
    </div>
  );
}
