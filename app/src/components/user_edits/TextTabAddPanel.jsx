/**
 * @fileoverview Bottom bar for adding elements, relations and arguments.
 * Spans the full width at ~20vh, always visible.
 *
 * Which link tabs it offers follows the graph: with plain relations hidden —
 * the default — only arguments are on offer, since a relation added there would
 * be a change the view has nowhere to show.
 *
 * Workflow-tab panels (AddElementPanel, AddArgumentPanel, AddRelationPanel)
 * live in WorkflowAddPanels.jsx.
 * @module components/TextTabAddPanel
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";

import { C } from "../../constants/colors.js";
import {
  argumentRelationType,
  newArgumentId,
  sortElementIds,
} from "../../utils/stateUtils.js";
import { ElementOptions } from "./ElementOptions.jsx";
import { RelationTypeOptions } from "./RelationTypeOptions.jsx";
import {
  SELECT_STYLE,
  makeArgumentDefaults,
  makeRelationDefaults,
} from "./addPanelShared.js";

const ELEMENT_DEFAULTS = {
  type: "judgment",
  confidence: 0.67,
  origin: "user",
  text: "",
};

const ghostBtn = {
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.dim,
  fontSize: 11,
  padding: "3px 7px",
  cursor: "pointer",
};

const arrowStyle = { color: C.dim, fontSize: 11, fontWeight: "bold" };

/**
 * @param {Object}      props
 * @param {REElement[]} props.elements   - Elements that may be referenced; see linkableElements.
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 * @param {boolean}     [props.hideNonEntailsRels] - When set, the graph is
 *   showing arguments only, so the bar offers those in place of relations:
 *   adding a link the view then hides is a change with nothing to show for it.
 */
export function AddBar({
  elements,
  onAddElement,
  onAddRelation,
  selected,
  ctrlTo,
  hideNonEntailsRels,
}) {
  const showRelations = !hideNonEntailsRels;
  const [activeTab, setActiveTab] = useState("element");
  const [elementForm, setElementForm] = useState(ELEMENT_DEFAULTS);
  const [relationForm, setRelationForm] = useState(() =>
    makeRelationDefaults(elements),
  );
  const [argumentForm, setArgumentForm] = useState(() =>
    makeArgumentDefaults(elements),
  );

  // The relation tab can be taken away underneath a reader standing on it, by
  // the setting flipping while the bar is open. Derived rather than corrected
  // in state, so the tab they were on is still there if it comes back.
  const tab =
    !showRelations && activeTab === "relation" ? "argument" : activeTab;
  /** The tab a graph selection fills in — the only kind of link on offer. */
  const linkTab = showRelations ? "relation" : "argument";

  // Selecting a node in the graph, or ctrl-selecting a second one, pre-fills the
  // link forms. This adjusts state during render rather than in an effect so
  // the panel never paints a frame showing the stale tab, and so a selection
  // that arrives on mount is picked up the same way as a later one — hence the
  // trackers start at null rather than at the current prop.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevSelected, setPrevSelected] = useState(null);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected) {
      // Both forms take it, so switching tabs afterwards does not lose the
      // selection. A reader already on a link tab is left where they are.
      setActiveTab((t) => (t === "element" ? linkTab : t));
      setRelationForm((prev) => ({ ...prev, from: selected }));
      setArgumentForm((prev) => ({
        ...prev,
        premises: [selected, ...prev.premises.slice(1)],
      }));
    }
  }

  const [prevCtrlTo, setPrevCtrlTo] = useState(null);
  if (ctrlTo !== prevCtrlTo) {
    setPrevCtrlTo(ctrlTo);
    if (ctrlTo) {
      setActiveTab((t) => (t === "element" ? linkTab : t));
      setRelationForm((prev) => ({ ...prev, to: ctrlTo }));
      setArgumentForm((prev) => ({ ...prev, conclusion: ctrlTo }));
    }
  }

  const setEl = (field, value) =>
    setElementForm((prev) => ({ ...prev, [field]: value }));
  const setRel = (field, value) =>
    setRelationForm((prev) => ({ ...prev, [field]: value }));
  const setArg = (field, value) =>
    setArgumentForm((prev) => ({ ...prev, [field]: value }));

  const ids = elements.map((e) => e.id).sort(sortElementIds);
  const { premises, conclusion, negated } = argumentForm;

  const setPremise = (i, id) =>
    setArg(
      "premises",
      premises.map((p, j) => (j === i ? id : p)),
    );
  const addPremise = () => {
    const taken = new Set([...premises, conclusion]);
    setArg("premises", [...premises, ids.find((id) => !taken.has(id)) ?? ""]);
  };
  const removePremise = (i) =>
    setArg(
      "premises",
      premises.filter((_, j) => j !== i),
    );

  const premiseSet = new Set(premises);
  const duplicatePremises = premiseSet.size < premises.length;
  const conclusionIsPremise = premiseSet.has(conclusion);
  const isElementValid = elementForm.text.trim().length > 0;
  const isRelationValid =
    relationForm.from &&
    relationForm.to &&
    relationForm.from !== relationForm.to;
  const isArgumentValid =
    premises.length > 0 &&
    premises.every(Boolean) &&
    conclusion &&
    !duplicatePremises &&
    !conclusionIsPremise;
  const canSubmit =
    tab === "element"
      ? isElementValid
      : tab === "relation"
        ? isRelationValid
        : isArgumentValid;

  const handleSubmit = () => {
    if (tab === "element") {
      onAddElement(elementForm);
      setElementForm(ELEMENT_DEFAULTS);
    } else if (tab === "relation") {
      onAddRelation(relationForm);
      setRelationForm(makeRelationDefaults(elements));
    } else {
      // One relation per premise, sharing an argumentId — that grouping is what
      // makes the graph draw them converging on a single arrow, and what lets
      // the whole argument be selected or deleted as one.
      const argumentId = newArgumentId();
      const type = argumentRelationType(premises.length, negated);
      premises.forEach((premise, i) =>
        onAddRelation(
          {
            from: premise,
            to: conclusion,
            type,
            argumentId,
            explanation: argumentForm.explanation,
          },
          { select: false, pinRecent: i === premises.length - 1 },
        ),
      );
      setArgumentForm(makeArgumentDefaults(elements));
    }
  };

  const tabBtn = (t) => ({
    padding: "2px 10px",
    borderRadius: 10,
    fontSize: 11,
    cursor: "pointer",
    border: `1px solid ${C.border}`,
    background: tab === t ? C.border : "transparent",
    color: tab === t ? C.text : C.dim,
  });

  return (
    <div
      // Ringed by the tour alongside the graph's + buttons: this is the other
      // way in, and the one with a text field rather than a dialog.
      data-tutorial="add-bar"
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
            // Allowed to shrink, so its own flexWrap has a width to wrap at.
            // Held at max-content it could not, and on a phone — where this bar
            // runs inside a sheet the width of the screen — the row ran off the
            // right edge instead of breaking. There is room to spare on a wide
            // screen, where nothing shrinks and nothing changes.
            minWidth: 0,
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
            Add {tab}
          </button>
          <button
            style={tabBtn("element")}
            onClick={() => setActiveTab("element")}
          >
            Element
          </button>
          {showRelations && (
            <button
              style={tabBtn("relation")}
              onClick={() => setActiveTab("relation")}
            >
              Relation
            </button>
          )}
          <button
            style={tabBtn("argument")}
            onClick={() => setActiveTab("argument")}
          >
            Argument
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
            // Shrinkable for the same reason as the tab row above. This is the
            // group that overflowed worst: an argument's premises, arrow, type
            // and conclusion are half a dozen controls on one line.
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          {tab === "element" ? (
            <>
              <select
                aria-label="Element type"
                value={elementForm.type}
                onChange={(e) => setEl("type", e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="judgment">Judgment</option>
                <option value="principle">Principle</option>
                <option value="theory">Theory</option>
              </select>
              {[
                { l: "L", v: 0.33, name: "Low" },
                { l: "M", v: 0.67, name: "Moderate" },
                { l: "H", v: 1.0, name: "High" },
              ].map(({ l, v, name }) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setEl("confidence", v)}
                  aria-label={`${name} confidence`}
                  title={`${name} confidence`}
                  aria-pressed={Math.abs(elementForm.confidence - v) < 0.01}
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
                aria-label="Confidence, 0 to 1"
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
                aria-label="Origin"
                value={elementForm.origin}
                onChange={(e) => setEl("origin", e.target.value)}
                placeholder="Origin"
                style={{ ...SELECT_STYLE, width: 90 }}
              />
            </>
          ) : tab === "relation" ? (
            <>
              <select
                aria-label="Relation from"
                value={relationForm.from}
                onChange={(e) => setRel("from", e.target.value)}
                style={SELECT_STYLE}
              >
                <ElementOptions elements={elements} />
              </select>
              <span style={arrowStyle}>→</span>
              <select
                aria-label="Relation type"
                value={relationForm.type}
                onChange={(e) => setRel("type", e.target.value)}
                style={{ ...SELECT_STYLE, color: C[relationForm.type] }}
              >
                <RelationTypeOptions />
              </select>
              <span style={arrowStyle}>→</span>
              <select
                aria-label="Relation to"
                value={relationForm.to}
                onChange={(e) => setRel("to", e.target.value)}
                style={SELECT_STYLE}
              >
                <ElementOptions elements={elements} />
              </select>
              {relationForm.from === relationForm.to && ids.length >= 2 && (
                <span style={{ fontSize: 10, color: C.conflicts }}>
                  From ≠ To
                </span>
              )}
            </>
          ) : (
            <>
              {/* Premises, joined by +. One argument can rest on several, and
                  they are added a row at a time rather than by a count field. */}
              {premises.map((premise, i) => (
                <span
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  {i > 0 && <span style={arrowStyle}>+</span>}
                  <select
                    aria-label={`Premise ${i + 1}`}
                    value={premise}
                    onChange={(e) => setPremise(i, e.target.value)}
                    style={SELECT_STYLE}
                  >
                    <ElementOptions elements={elements} />
                  </select>
                  {premises.length > 1 && (
                    <button
                      onClick={() => removePremise(i)}
                      aria-label={`Remove premise ${i + 1}`}
                      title={`Remove premise ${i + 1}`}
                      style={ghostBtn}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              <button
                onClick={addPremise}
                disabled={ids.length <= premises.length + 1}
                style={{
                  ...ghostBtn,
                  opacity: ids.length <= premises.length + 1 ? 0.4 : 1,
                }}
              >
                + premise
              </button>
              <span style={arrowStyle}>→</span>
              <select
                aria-label="Argument type"
                value={negated ? "precludes" : "entails"}
                onChange={(e) =>
                  setArg("negated", e.target.value === "precludes")
                }
                style={{
                  ...SELECT_STYLE,
                  color: negated ? C.precludes : C.entails,
                }}
              >
                <option value="entails">entails</option>
                <option value="precludes">precludes</option>
              </select>
              <span style={arrowStyle}>→</span>
              <select
                aria-label="Conclusion"
                value={conclusion}
                onChange={(e) => setArg("conclusion", e.target.value)}
                style={SELECT_STYLE}
              >
                <ElementOptions elements={elements} />
              </select>
              {(duplicatePremises || conclusionIsPremise) &&
                ids.length >= 2 && (
                  <span style={{ fontSize: 10, color: C.conflicts }}>
                    {duplicatePremises
                      ? "Premises must differ"
                      : "Premise ≠ conclusion"}
                  </span>
                )}
            </>
          )}
        </div>
      </div>

      {/* ── Text / explanation ── */}
      <textarea
        value={
          tab === "element"
            ? elementForm.text
            : tab === "relation"
              ? relationForm.explanation
              : argumentForm.explanation
        }
        onChange={(e) =>
          tab === "element"
            ? setEl("text", e.target.value)
            : tab === "relation"
              ? setRel("explanation", e.target.value)
              : setArg("explanation", e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey && canSubmit) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={
          tab === "element"
            ? "Enter statement…"
            : tab === "argument"
              ? negated
                ? "Why do these premises preclude the conclusion? (optional)"
                : "Why do these premises entail the conclusion? (optional)"
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
