/**
 * @fileoverview Bottom bar for adding elements, relations and arguments.
 * Spans the full width at ~20vh, always visible — or, with `roomy`, laid out
 * for the phone sheet that hosts it there instead.
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
import { ARGUMENT_GLOSS } from "../../constants/glosses.js";
import { inkWeight } from "../../constants/palettes.js";
import { useAddBarSize } from "../../hooks/useAddBarSize.js";
import { usePalette } from "../../hooks/useTheme.js";
import {
  originOrDefault,
  setLastOrigin,
  useLastOrigin,
} from "../../utils/lastOrigin.js";
import {
  argumentRelationType,
  newArgumentId,
  sortElementIds,
} from "../../utils/stateUtils.js";
import { Dropdown } from "./Dropdown.jsx";
import { elementOptions, elementTypeOptions } from "./ElementOptions.jsx";
import { relationTypeOptions } from "./RelationTypeOptions.jsx";
import {
  ACCENT_MARKER,
  ADD_BAR_MIN_HEIGHT,
  arrowStyle,
  complaintStyle,
  fieldStyle,
  ghostBtn,
  idOptionChars,
  makeArgumentDefaults,
  makeRelationDefaults,
  pickerWidth,
  selectStyle,
} from "./addPanelShared.js";
import { Field } from "./addPanelPrimitives.jsx";

// Origin is deliberately not among them: it is who is adding rather than part
// of the element being written, and so is kept across a clear, an add and a tab
// change alike. See {@link module:utils/lastOrigin}.
const ELEMENT_DEFAULTS = {
  type: "judgment",
  confidence: 0.67,
  text: "",
};

// The three lists that do not depend on what is on the board, built once. Each
// row carries its gloss as the detail the picker draws beside the label.
const TYPE_OPTIONS = elementTypeOptions();
const RELATION_ROWS = relationTypeOptions();
const ARGUMENT_ROWS = [
  { value: "entails", label: "entails", detail: ARGUMENT_GLOSS.entails },
  { value: "precludes", label: "precludes", detail: ARGUMENT_GLOSS.precludes },
];

/**
 * @param {Object}      props
 * @param {REElement[]} props.elements   - Elements that may be referenced; see linkableElements.
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 * @param {boolean}     [props.hideNonEntailsRels] - When set, the graph is
 *   showing arguments only, so the bar offers those in place of relations:
 *   adding a link the view then hides is a change with nothing to show for it.
 * @param {boolean}     [props.roomy] - Lays the bar out for the phone sheet,
 *   which has height to spare and is worked with a thumb. See {@link ghostBtn}.
 */
export function AddBar({
  elements,
  onAddElement,
  onAddRelation,
  selected,
  ctrlTo,
  hideNonEntailsRels,
  roomy = false,
}) {
  // The element tab's trimmings stay small; the link tabs' pickers are the
  // content and are drawn as such. The phone sizes everything alike, having
  // room for one size only.
  const size = roomy ? "roomy" : "compact";
  const linkSize = roomy ? "roomy" : "prominent";
  // The strip is the reader's to size — the three tabs want different shapes of
  // it, and only they know which they are about to use. The sheet keeps its own.
  const { ref: barRef, sizeStyle, handleProps } = useAddBarSize(!roomy);
  // The bar's two filled buttons — Add, and whichever tab is lit — are written
  // in the palette's own ink rather than in an ink named here, so that they read
  // as the same object in either viewing mode: white and bold on the teal in the
  // default one, the black the assist headers' badges wear and no weight with it
  // in high-contrast. Weight follows the ink for the reason node ids do, see
  // {@link module:constants/palettes.inkWeight}.
  //
  // White on this teal is 2.43:1, which is the default palette's usual bargain
  // rather than an oversight here: it is judged by eye and high-contrast mode is
  // the compliant path. See {@link ACCENT_MARKER}, and WorkflowAddPanels, whose
  // three add buttons are drawn by the same rule.
  const palette = usePalette();
  const fillInk = palette.ink;
  const fillWeight = inkWeight(fillInk);
  const ghost = ghostBtn(linkSize);
  const arrow = arrowStyle(linkSize);
  const sel = selectStyle(size);
  const linkSel = selectStyle(linkSize);
  /** For the fields that are not selects, and so must not wear its chevron. */
  const box = fieldStyle(size);
  /** Width for an element picker: the longest id it can offer, suffix and all. */
  const idLayout = pickerWidth(idOptionChars(elements));
  /** The rows every element picker in the bar offers — id, and what it says. */
  const elementRows = elementOptions(elements);
  const showRelations = !hideNonEntailsRels;
  // Origin and confidence, folded away on a phone. Kept across submissions
  // rather than reset with the form: someone who opened them once is filling
  // them in, and closing them under that reader after every add would be rude.
  const [showMeta, setShowMeta] = useState(false);
  // Bumped whenever the text field is emptied out from under the reader, and
  // used as its key so a cleared field is a genuinely new one. Two reasons: the
  // browser's own undo stack goes with it, so ctrl-Z cannot put back text that
  // Clear just took away; and the placeholder is laid out afresh, rather than
  // kept at the wrapping the old node had worked out for the old string.
  const [generation, setGeneration] = useState(0);
  const [activeTab, setActiveTab] = useState("element");
  const [elementForm, setElementForm] = useState(ELEMENT_DEFAULTS);
  const origin = useLastOrigin();
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

  /**
   * Puts the tab on show back to how it started — one premise again, in the
   * case of an argument that has grown several. The same thing a successful add
   * does to it, so Clear is "as if you had just added one", not a separate idea
   * of what empty means.
   */
  const resetTab = () => {
    if (tab === "element") setElementForm(ELEMENT_DEFAULTS);
    else if (tab === "relation")
      setRelationForm(makeRelationDefaults(elements));
    else setArgumentForm(makeArgumentDefaults(elements));
  };

  /**
   * Clear is a reset plus a new field. Submitting is not: it leaves the reader
   * where they were, and after a ctrl-enter that is inside the field they are
   * still typing in — replacing it there would take the focus with it.
   */
  const handleClear = () => {
    resetTab();
    setGeneration((n) => n + 1);
  };

  const handleSubmit = () => {
    if (tab === "element") {
      onAddElement({ ...elementForm, origin: originOrDefault(origin) });
    } else if (tab === "relation") {
      onAddRelation(relationForm);
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
    }
    resetTab();
  };

  /**
   * Everything one of the three tab buttons wears, its handler included — the
   * accent marker goes on the lit one only, so it has to be an attribute rather
   * than part of a style object.
   */
  const tabProps = (t) => {
    const active = tab === t;
    return {
      "aria-pressed": active,
      onClick: () => setActiveTab(t),
      // Only while it is carrying the fill. See {@link ACCENT_MARKER}.
      ...(active ? ACCENT_MARKER : null),
      style: {
        // Small enough that all three sit beside the submit button on one line —
        // including the case that has to fit, with relations on offer — and a
        // clear step under it: they choose what is added, it does the adding.
        padding: roomy ? "8px 11px" : "2px 10px",
        minHeight: roomy ? 38 : undefined,
        borderRadius: 10,
        fontSize: roomy ? 12 : 11,
        cursor: "pointer",
        // Lit in the button colour the bar's own Add wears, so the pair reads as
        // one control: these say what is being added and it does the adding. The
        // submit button beside them carries no type in its label, so which of
        // them is lit is the only thing on screen saying what pressing it would
        // add — hence fill and border together, rather than a tint alone. Weight
        // is not a third statement of it: on a fill it belongs to the ink.
        border: `1px solid ${active ? C.supports : C.border}`,
        fontWeight: active ? fillWeight : "normal",
        background: active ? C.supports : "transparent",
        color: active ? fillInk : C.dim,
      },
    };
  };

  /**
   * One button, put in one of two places: the far end of the tab row on a
   * phone, or past the fields on a wide screen. Either way it ends up as far
   * from Add as the layout allows, which is the point of it.
   */
  /**
   * A link needs two ends. Until the graph has two elements the pickers stand
   * empty and Add is dead, and a disabled button gives no reason — so the space
   * the other complaints use says what is missing instead of staying blank.
   */
  const tooFewElements = ids.length < 2;
  const needsTwo = (
    <span role="status" style={complaintStyle(linkSize)}>
      Add two elements first
    </span>
  );

  const clearButton = (
    <button
      onClick={handleClear}
      // Named for what it clears, as the submit button is: which tab is lit is
      // the only thing saying what either of them acts on.
      aria-label={`Clear ${tab}`}
      title="Start this tab over"
      style={{
        ...ghostBtn(size),
        marginLeft: "auto",
        flexShrink: 0,
        ...(roomy ? { minHeight: 44 } : null),
      }}
    >
      Clear
    </button>
  );

  return (
    <div
      ref={barRef}
      // Ringed by the tour alongside the graph's + buttons: this is the other
      // way in, and the one with a text field rather than a dialog.
      data-tutorial="add-bar"
      style={{
        // The sheet is capped at 85dvh and scrolls past that, so asking for a
        // good share of the screen here is what makes the controls and the text
        // field roomy rather than merely spaced out.
        //
        // The strip's own share is a floor rather than a size: the text field
        // takes whatever the controls leave over, and anyone who wants more of
        // it drags the bar's top edge. See {@link module:hooks/useAddBarSize}.
        // The floor is the assist panels' too — one add bar, one height.
        minHeight: roomy ? "46dvh" : ADD_BAR_MIN_HEIGHT,
        flexShrink: 0,
        borderTop: `1px solid ${C.border}`,
        background: C.panel,
        display: "flex",
        flexDirection: "column",
        padding: roomy ? "12px 14px 16px" : "8px 16px",
        // Last, so a dragged size wins over the floor above.
        ...sizeStyle,
      }}
    >
      {/* Two edges and the corner between them. The bar is anchored at the foot
          of the window and at the left of the row, so those are the two that
          can move. */}
      {!roomy && (
        <>
          <div {...handleProps("height")} />
          <div {...handleProps("width")} />
          <div {...handleProps("both")} />
        </>
      )}

      {/* ── Controls row ── */}
      <div
        style={{
          display: "flex",
          // Not centre: the fields beside these grow taller as an argument
          // takes on premises and its row wraps, and centring made the submit
          // button and the tabs drift down to stay level with the middle of
          // whatever was next to them. They belong to no one tab, so they sit
          // where they sat before it was chosen.
          alignItems: "flex-start",
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
            // …on the phone, where it is the only way these fit. On a wide
            // screen there is room, and holding them at their full width is
            // what keeps them the same width on every tab: a tab whose fields
            // outgrew the row would otherwise squeeze the buttons above them.
            //
            // The phone's copy takes the whole row as well, so that Clear's
            // auto margin has the row's far edge to reach for. Sized to its
            // contents it stopped at the end of the buttons, short of the edge.
            ...(roomy ? { flexBasis: "100%" } : { flexShrink: 0 }),
          }}
        >
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            // Named in full for anyone who cannot see which tab is lit. The
            // visible "Add" is inside it, as WCAG 2.5.3 asks of any control
            // whose label is shorter than its accessible name.
            aria-label={`Add ${tab}`}
            title={`Add ${tab} — ⌘/Ctrl + Enter`}
            {...ACCENT_MARKER}
            style={{
              // The auto margin is what holds it to the right of the strip. It
              // leads the row here, so it starts at the left edge everything
              // below it lines up against.
              marginLeft: roomy ? 0 : "auto",
              padding: roomy ? "11px 18px" : "3px 14px",
              minHeight: roomy ? 44 : undefined,
              borderRadius: 4,
              fontSize: roomy ? 15 : 12,
              fontWeight: fillWeight,
              cursor: canSubmit ? "pointer" : "default",
              border: "none",
              background: C.supports,
              color: fillInk,
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {/* Just "Add": the lit tab is what says what is being added, so
                repeating it here only costs the tabs room on the line. */}
            Add
          </button>
          {/* On the phone it shares this line, at the far end of it — a row of
              its own for one button was a waste of a screen that has none to
              spare, and opposite ends of a row is distance enough. On a wide
              screen it goes past the fields instead; see below. */}
          {roomy && clearButton}
          {/* Grouped so the three stay together: as loose items they were free
              to wrap apart from one another, which split the set across two
              rows. Grouped, a row too narrow for all four breaks after the
              submit button instead and drops the three intact onto the next. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: roomy ? 6 : 8,
              minWidth: 0,
              flexWrap: "wrap",
              // A line of its own on the phone, which puts Add and Clear
              // together on the one above rather than leaving where the row
              // breaks to whatever the labels happen to measure.
              ...(roomy ? { flexBasis: "100%" } : null),
            }}
          >
            <button {...tabProps("element")}>Element</button>
            {showRelations && (
              <button {...tabProps("relation")}>Relation</button>
            )}
            <button {...tabProps("argument")}>Argument</button>
          </div>
          {/* Separates the tabs from the fields beside them. Stacked, there is
              nothing to its right to separate them from. */}
          {!roomy && (
            <div
              style={{
                width: 1,
                height: 16,
                background: C.border,
                flexShrink: 0,
              }}
            />
          )}
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
            // Either way it takes the whole row rather than sizing to its
            // contents. Roomy, because sized to contents, opening the details
            // widened the group — and with it the type picker inside, which
            // grows to fill the group; a picker has no business changing width
            // because something below it appeared. Wide, because origin and
            // confidence are held against the far end of the bar, and there is
            // no far end to hold them against until the group reaches it.
            ...(roomy ? { flexBasis: "100%" } : { flex: 1 }),
          }}
        >
          {tab === "element" ? (
            <>
              {/* The three are the domain's own terms, and a first-time reader
                  has no way to tell a principle from a theory by the word
                  alone; the gloss rides in the row beside each. */}
              <Dropdown
                label="Element type"
                value={elementForm.type}
                onChange={(v) => setEl("type", v)}
                options={TYPE_OPTIONS}
                style={sel}
                // 9 for "Principle", the longest of the three. Roomy shares
                // the line with Details, the pair filling the row — growing
                // from their content widths rather than from nothing, since
                // `flex: 1` would start both at zero and split the row evenly,
                // which cut "Judgment" off halfway.
                layout={{
                  ...pickerWidth(9),
                  ...(roomy ? { flex: "1 1 auto" } : null),
                }}
              />
              {/* Both of these carry a working default, so on a phone they are
                  detail rather than something to fill in: the statement is what
                  the reader came to type. Folded away by default there, and
                  always shown in the strip, which has the width for them. */}
              {roomy && (
                <button
                  type="button"
                  onClick={() => setShowMeta((s) => !s)}
                  aria-expanded={showMeta}
                  style={{
                    ...ghost,
                    flex: "1 1 auto",
                    // The picker's height rather than the ghost buttons' own,
                    // since it is standing beside one rather than among them.
                    minHeight: sel.minHeight,
                    fontSize: 14,
                  }}
                >
                  Details {showMeta ? "▴" : "▾"}
                </button>
              )}
              {(!roomy || showMeta) && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: roomy ? 16 : 8,
                    flexWrap: "wrap",
                    ...(roomy
                      ? // A line of their own, so the two sit side by side
                        // under the type picker rather than trailing off it.
                        { flexBasis: "100%" }
                      : // Out to the far corner of the bar. They are what the
                        // element is filed under rather than part of writing
                        // it, so they sit apart from the controls that are.
                        { marginLeft: "auto" }),
                  }}
                >
                  <Field label="By" roomy={roomy}>
                    <input
                      aria-label="Origin"
                      value={origin}
                      onChange={(e) => setLastOrigin(e.target.value)}
                      placeholder="Origin"
                      style={{ ...box, width: roomy ? 118 : 90 }}
                    />
                  </Field>
                  {/* L, M and H said nothing about what they set, and the number
                      beside them said less. */}
                  <Field label="Confidence" roomy={roomy}>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
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
                          aria-pressed={
                            Math.abs(elementForm.confidence - v) < 0.01
                          }
                          style={{
                            ...box,
                            // Single letters, so they are squared off rather
                            // than left as the slivers picker padding makes.
                            padding: roomy ? 0 : "3px 7px",
                            minWidth: roomy ? 38 : undefined,
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
                        title="Or any value between 0 and 1"
                        min={0}
                        max={1}
                        step={0.05}
                        value={elementForm.confidence}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v))
                            setEl("confidence", Math.max(0, Math.min(1, v)));
                        }}
                        // The spinner is worth its width on a mouse and nothing
                        // at all under a thumb, where it was crowding the value
                        // it steps out of the field altogether.
                        className={roomy ? "no-spinner" : undefined}
                        style={{ ...box, width: roomy ? 72 : 55 }}
                      />
                    </span>
                  </Field>
                </span>
              )}
            </>
          ) : tab === "relation" ? (
            <>
              <Dropdown
                label="Relation from"
                value={relationForm.from}
                onChange={(v) => setRel("from", v)}
                options={elementRows}
                style={linkSel}
                layout={idLayout}
              />
              <span style={arrow}>→</span>
              <Dropdown
                label="Relation type"
                value={relationForm.type}
                onChange={(v) => setRel("type", v)}
                options={RELATION_ROWS}
                // The colour goes on the trigger, so the chevron and the list's
                // own labels take it too.
                style={{ ...linkSel, color: C[relationForm.type] }}
                // 10 for "undermines" and "depends on", the longest offered.
                layout={pickerWidth(10)}
              />
              <span style={arrow}>→</span>
              <Dropdown
                label="Relation to"
                value={relationForm.to}
                onChange={(v) => setRel("to", v)}
                options={elementRows}
                style={linkSel}
                layout={idLayout}
              />
              {tooFewElements ? (
                needsTwo
              ) : relationForm.from === relationForm.to ? (
                <span role="status" style={complaintStyle(linkSize)}>
                  From ≠ To
                </span>
              ) : null}
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
                  <Dropdown
                    label={`Premise ${i + 1}`}
                    value={premise}
                    onChange={(v) => setPremise(i, v)}
                    options={elementRows}
                    style={linkSel}
                    layout={idLayout}
                  />
                  {premises.length > 1 && (
                    <button
                      onClick={() => removePremise(i)}
                      aria-label={`Remove premise ${i + 1}`}
                      title={`Remove premise ${i + 1}`}
                      style={ghost}
                    >
                      ✕
                    </button>
                  )}
                  {premises.length > 1 && i < premises.length - 1 && (
                    <span style={arrow}>+</span>
                  )}
                </span>
              ))}
              <button
                onClick={addPremise}
                disabled={ids.length <= premises.length + 1}
                style={{
                  ...ghost,
                  opacity: ids.length <= premises.length + 1 ? 0.4 : 1,
                }}
              >
                + premise
              </button>
              <Dropdown
                label="Argument type"
                value={negated ? "precludes" : "entails"}
                onChange={(v) => setArg("negated", v === "precludes")}
                options={ARGUMENT_ROWS}
                // The colour goes on the trigger, so the chevron and the list's
                // own labels take it too.
                style={{
                  ...linkSel,
                  color: negated ? C.precludes : C.entails,
                }}
                // 9 for "precludes".
                layout={pickerWidth(9)}
              />
              <span style={arrow}>→</span>
              <Dropdown
                label="Conclusion"
                value={conclusion}
                onChange={(v) => setArg("conclusion", v)}
                options={elementRows}
                style={linkSel}
                layout={idLayout}
              />
              {tooFewElements ? (
                needsTwo
              ) : duplicatePremises || conclusionIsPremise ? (
                <span role="status" style={complaintStyle(linkSize)}>
                  {duplicatePremises
                    ? "Premises must differ"
                    : "Premise ≠ conclusion"}
                </span>
              ) : null}
            </>
          )}
        </div>
        {/* Past all the fields and against the far edge, which the growing
            fields group is what carries it out to. It undoes the work the rest
            of the row is for, so it wants to be nowhere near the button that
            commits it — beside Add it read as a second way to submit. */}
        {!roomy && clearButton}
      </div>

      {/* ── Text / explanation ── */}
      <textarea
        // Keyed on the tab as well as the generation: each tab's placeholder is
        // a different length, and reusing one node across them left the old
        // string's line breaks behind — "Explanation (optional)…" came out as
        // "Explan". See the generation counter for the rest of why.
        key={`${tab}-${generation}`}
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
          // metaKey too: on a Mac the shortcut people reach for is cmd-enter,
          // and the app's own undo already answers to both.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSubmit) {
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
          // `flex: 1` alone gives it whatever the controls leave over, which on
          // a phone is not much once the controls have wrapped onto three
          // lines. The floor is what makes it a field worth typing into.
          //
          // 0 rather than nothing in the strip: a textarea's own content height
          // is a floor `flex: 1` cannot shrink past, so a bar dragged short had
          // the field push its own bottom edge out of the panel instead.
          minHeight: roomy ? 130 : 0,
          marginTop: roomy ? 12 : 8,
          resize: "none",
          width: "100%",
          boxSizing: "border-box",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.text,
          padding: roomy ? "10px 12px" : "6px 10px",
          fontSize: roomy ? 16 : 14,
          outline: "none",
        }}
      />
    </div>
  );
}
