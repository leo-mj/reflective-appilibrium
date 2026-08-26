/**
 * @fileoverview Add panels for use inside workflow (assist) tabs.
 * AddElementPanel, AddArgumentPanel, and AddRelationPanel each render
 * a compact bottom panel for adding a single element or relation type.
 * @module components/WorkflowAddPanels
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";

import { C } from "../../constants/colors.js";
import { inkWeight } from "../../constants/palettes.js";
import { useAddBarSize } from "../../hooks/useAddBarSize.js";
import { usePalette } from "../../hooks/useTheme.js";
import {
  originOrDefault,
  setLastOrigin,
  useLastOrigin,
} from "../../utils/lastOrigin.js";
import {
  sortElementIds,
  defaultPickerIds,
  newArgumentId,
} from "../../utils/stateUtils.js";
import { Tooltip } from "../Tooltip.jsx";
import { ElementOptions } from "./ElementOptions.jsx";
import { RelationTypeOptions } from "./RelationTypeOptions.jsx";
import {
  ACCENT_MARKER,
  SELECT_STYLE,
  PANEL_STYLE,
  makeRelationDefaults,
} from "./addPanelShared.js";
import { Field } from "./addPanelPrimitives.jsx";

/**
 * What all three panels' add buttons wear.
 *
 * One fill for the three of them, and the same one the add bar's own submit
 * button and lit tab carry: adding a judgment from an assist tab is the same act
 * as adding one from the bar, and looked like a different one while these were
 * coloured per panel. The argument panel's entails/precludes colour has not gone
 * anywhere — it is on the toggle beside the button, which is what that colour is
 * about; the button is just the button.
 *
 * The ink is the palette's rather than one named here, so it follows the viewing
 * mode: white and bold on the teal by default, black and unweighted on it in
 * high-contrast, exactly as an assist tab's header badge is written. Weight
 * follows the ink for the reason node ids do — see
 * {@link module:constants/palettes.inkWeight} — and the contrast this costs in
 * the default mode is accounted for in {@link ACCENT_MARKER}.
 *
 * @param {boolean} canSubmit
 */
function useAddButtonStyle(canSubmit) {
  const ink = usePalette().ink;
  return {
    padding: "3px 14px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: inkWeight(ink),
    cursor: canSubmit ? "pointer" : "default",
    border: "none",
    background: C.supports,
    color: ink,
    opacity: canSubmit ? 1 : 0.4,
  };
}


/**
 * The box all three panels are drawn in, and the top edge that sizes it.
 *
 * The height is the add bar's own, read from and written back to the one key
 * every bar shares, so a panel dragged taller in one assist tab is that tall in
 * the next one and in the strip under the text panel — see
 * {@link module:hooks/useAddBarSize}. The width is not offered: a panel is as
 * wide as the column the central divider has left it, which is dragged there
 * rather than here.
 */
function Panel({ children }) {
  const { ref, sizeStyle, handleProps } = useAddBarSize(true, {
    axes: "height",
  });
  return (
    <div ref={ref} style={{ ...PANEL_STYLE, ...sizeStyle }}>
      <div {...handleProps("height")} />
      {children}
    </div>
  );
}

/**
 * Minimal add-element panel for use inside an assist tab.
 * The element type is fixed.
 *
 * @param {Object}   props
 * @param {"judgment"|"principle"|"theory"} props.elementType
 * @param {function} props.onAddElement
 */
export function AddElementPanel({ elementType, onAddElement }) {
  const [form, setForm] = useState({ confidence: 0.67, text: "" });
  // Not part of the form, and so not cleared with it: the origin is who is
  // adding, which does not change between one element and the next, while the
  // statement and its confidence are the element itself. See
  // {@link module:utils/lastOrigin}.
  const origin = useLastOrigin();
  const set = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));
  const canSubmit = form.text.trim().length > 0;
  const addStyle = useAddButtonStyle(canSubmit);
  const handleSubmit = () => {
    onAddElement({
      type: elementType,
      ...form,
      origin: originOrDefault(origin),
    });
    setForm({ confidence: 0.67, text: "" });
  };
  return (
    <Panel>
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
          style={addStyle}
          {...ACCENT_MARKER}
        >
          Add {elementType}
        </button>
        {/* Captioned and placed exactly as the add bar's pair is: an unlabelled
            box beside three unlabelled letters says nothing about what either
            sets, and a reader who has met them in the analyze bar should not
            have to work them out again here. Held against the far end for the
            bar's reason too — they are what the element is filed under, rather
            than part of writing it. */}
        <span
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          <Field label="By">
            <input
              aria-label="Origin"
              value={origin}
              onChange={(e) => setLastOrigin(e.target.value)}
              placeholder="Origin"
              style={{ ...SELECT_STYLE, width: 90 }}
            />
          </Field>
          <Field label="Confidence">
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[
                { l: "L", v: 0.33, name: "Low" },
                { l: "M", v: 0.67, name: "Moderate" },
                { l: "H", v: 1.0, name: "High" },
              ].map(({ l, v, name }) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => set("confidence", v)}
                  aria-label={`${name} confidence`}
                  title={`${name} confidence`}
                  aria-pressed={Math.abs(form.confidence - v) < 0.01}
                  style={{
                    ...SELECT_STYLE,
                    padding: "3px 7px",
                    background:
                      Math.abs(form.confidence - v) < 0.01
                        ? C.border
                        : "transparent",
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
                aria-label="Confidence, 0 to 1"
                title="Or any value between 0 and 1"
                value={form.confidence}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v))
                    set("confidence", Math.max(0, Math.min(1, v)));
                }}
                style={{ ...SELECT_STYLE, width: 55 }}
              />
            </span>
          </Field>
        </span>
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
    </Panel>
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
  const addStyle = useAddButtonStyle(canSubmit);

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
    <Panel>
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
          style={{ ...addStyle, flexShrink: 0, alignSelf: "center" }}
          {...ACCENT_MARKER}
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
                // Numbered, because there may be several: "Premise" alone would
                // give every one of them the same name, which is what a screen
                // reader user hears as one control repeated.
                aria-label={`Premise ${i + 1}`}
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
          aria-label="Conclusion"
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
    </Panel>
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
  const addStyle = useAddButtonStyle(canSubmit);
  const handleSubmit = () => {
    onAddRelation(form);
    setForm(makeRelationDefaults(elements));
  };
  return (
    <Panel>
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
          style={addStyle}
          {...ACCENT_MARKER}
        >
          Add relation
        </button>
        <select
          value={form.from}
          aria-label="Relation from"
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
          aria-label="Relation type"
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
          aria-label="Relation to"
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
    </Panel>
  );
}
