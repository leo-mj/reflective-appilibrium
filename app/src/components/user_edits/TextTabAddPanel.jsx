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

/**
 * The three sizes anything in the bar is drawn at.
 *
 * `roomy` is the phone's version. There the bar is not a strip along the foot
 * of a working screen but a sheet with most of the screen to itself, and
 * everything in it is pressed with a thumb rather than clicked. It is a prop
 * rather than a media query because it follows the container, not the device:
 * the wide layout keeps its strip on a touchscreen, where there is still a
 * graph above it with a better claim on the height.
 *
 * - `compact` — the strip's default, for the element tab, where the statement
 *   below the controls is the thing being written and they are its trimmings.
 * - `prominent` — the link tabs on a wide screen. There the pickers *are* the
 *   content: an argument is its premises and its conclusion, and the box under
 *   them holds an optional note. At the compact size they were dwarfed by it.
 * - `roomy` — the phone sheet, where everything is worked with a thumb.
 */
const SIZES = {
  compact: { padding: "3px 6px", fontSize: 14 },
  prominent: { padding: "7px 12px", fontSize: 17, minHeight: 40 },
  roomy: { padding: "8px 12px", fontSize: 16, minHeight: 44 },
};

const GHOST_SIZES = {
  compact: { padding: "3px 7px", fontSize: 11 },
  prominent: { padding: "7px 12px", fontSize: 14, minHeight: 40 },
  roomy: { padding: "8px 12px", fontSize: 13, minHeight: 40 },
};

const ARROW_SIZES = { compact: 11, prominent: 15, roomy: 14 };

const ghostBtn = (size) => ({
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.dim,
  cursor: "pointer",
  ...GHOST_SIZES[size],
});

const arrowStyle = (size) => ({
  color: C.dim,
  fontSize: ARROW_SIZES[size],
  fontWeight: "bold",
});

/**
 * The chevron a select draws for itself, drawn by us instead — see below for
 * why we take it over. Slate 400: one grey that reads on either theme, since a
 * data URI cannot see the CSS variables the rest of the bar is coloured from.
 */
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none' stroke='%2394a3b8' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

/**
 * The box every field in the bar sits in — pickers, text inputs and the letter
 * buttons alike.
 *
 * @param {keyof SIZES} size
 */
const fieldStyle = (size) => ({ ...SELECT_STYLE, ...SIZES[size] });

/**
 * Width enough for the longest thing a picker can hold, rather than for the one
 * it happens to hold now. A select sizes itself to its selected option, so
 * without this the picker changed width every time it was used — and the widest
 * options were left crowding the chevron.
 *
 * In `ch` so it tracks whichever of the reader's fonts is in use, plus a fixed
 * allowance for the padding and the chevron's reserved strip.
 *
 * @param {number} chars - Length of the longest option label.
 */
const pickerWidth = (chars) => ({ minWidth: `calc(${chars}ch + 46px)` });

/** The longest option an element picker holds, counting the status suffixes. */
const idOptionChars = (elements) =>
  Math.max(
    4,
    ...elements.map(
      (e) =>
        e.id.length +
        (e.status === "withdrawn" ? 12 : e.status === "rejected" ? 11 : 0),
    ),
  );

/**
 * The shared box for an actual `<select>`, which needs two things the others
 * must not borrow: the chevron, and the room on the right to draw it in.
 *
 * @param {keyof SIZES} size
 */
const selectStyle = (size) => ({
  ...fieldStyle(size),
  // WebKit renders a select at whatever height its own control wants and
  // ignores min-height and vertical padding on it, so a picker asked to match
  // the things beside it simply did not. Dropping the native appearance is what
  // gives the box back — at the cost of the arrow it drew, hence the one
  // painted on the right.
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: CHEVRON,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  backgroundSize: "10px 6px",
  paddingRight: 28,
});

/**
 * A control with its caption — above it where the bar is roomy, beside it in
 * the strip. Roomy lays several of these out side by side, and a caption of a
 * fixed height above each one is what makes their controls line up rather than
 * sit at whatever height their own label happened to leave them.
 */
function Field({ label, roomy, children }) {
  return (
    <span
      style={{
        display: "flex",
        flexDirection: roomy ? "column" : "row",
        alignItems: roomy ? "flex-start" : "center",
        gap: roomy ? 3 : 6,
      }}
    >
      <span style={{ fontSize: 11, color: C.dim, lineHeight: 1.2 }}>
        {label}
      </span>
      {children}
    </span>
  );
}

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
  const ghost = ghostBtn(linkSize);
  const arrow = arrowStyle(linkSize);
  const sel = selectStyle(size);
  const linkSel = selectStyle(linkSize);
  /** For the fields that are not selects, and so must not wear its chevron. */
  const box = fieldStyle(size);
  /** An element picker, held at the width of the longest id it can offer. */
  const idSel = { ...linkSel, ...pickerWidth(idOptionChars(elements)) };
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
    setGeneration((n) => n + 1);
  };

  const handleSubmit = () => {
    if (tab === "element") {
      onAddElement(elementForm);
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

  const tabBtn = (t) => {
    const active = tab === t;
    return {
      // Small enough that all three sit beside the submit button on one line —
      // including the case that has to fit, with relations on offer — and a
      // clear step under it: they choose what is added, it does the adding.
      padding: roomy ? "8px 11px" : "2px 10px",
      minHeight: roomy ? 38 : undefined,
      borderRadius: 10,
      fontSize: roomy ? 12 : 11,
      cursor: "pointer",
      // Stated three times over — fill, border and weight. The submit button
      // beside these reads only "Add", so which of them is lit is the only
      // thing on screen saying what pressing it would add.
      border: `1px solid ${active ? C.text : C.border}`,
      fontWeight: active ? "bold" : "normal",
      background: active ? C.border : "transparent",
      color: active ? C.text : C.dim,
    };
  };

  return (
    <div
      // Ringed by the tour alongside the graph's + buttons: this is the other
      // way in, and the one with a text field rather than a dialog.
      data-tutorial="add-bar"
      style={{
        // The sheet is capped at 85dvh and scrolls past that, so asking for a
        // good share of the screen here is what makes the controls and the text
        // field roomy rather than merely spaced out.
        minHeight: roomy ? "46dvh" : "20vh",
        flexShrink: 0,
        borderTop: `1px solid ${C.border}`,
        background: C.panel,
        display: "flex",
        flexDirection: "column",
        padding: roomy ? "12px 14px 16px" : "8px 16px",
      }}
    >
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
            ...(roomy ? null : { flexShrink: 0 }),
          }}
        >
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            // Named in full for anyone who cannot see which tab is lit. The
            // visible "Add" is inside it, as WCAG 2.5.3 asks of any control
            // whose label is shorter than its accessible name.
            aria-label={`Add ${tab}`}
            style={{
              // The auto margin is what holds it to the right of the strip. It
              // leads the row here, so it starts at the left edge everything
              // below it lines up against.
              marginLeft: roomy ? 0 : "auto",
              padding: roomy ? "11px 18px" : "3px 14px",
              minHeight: roomy ? 44 : undefined,
              borderRadius: 4,
              fontSize: roomy ? 15 : 12,
              fontWeight: "bold",
              cursor: canSubmit ? "pointer" : "default",
              border: "none",
              background: C.supports,
              color: "#fff",
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {/* Just "Add": the lit tab is what says what is being added, so
                repeating it here only costs the tabs room on the line. */}
            Add
          </button>
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
            }}
          >
            <button
              style={tabBtn("element")}
              aria-pressed={tab === "element"}
              onClick={() => setActiveTab("element")}
            >
              Element
            </button>
            {showRelations && (
              <button
                style={tabBtn("relation")}
                aria-pressed={tab === "relation"}
                onClick={() => setActiveTab("relation")}
              >
                Relation
              </button>
            )}
            <button
              style={tabBtn("argument")}
              aria-pressed={tab === "argument"}
              onClick={() => setActiveTab("argument")}
            >
              Argument
            </button>
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
              <select
                aria-label="Element type"
                value={elementForm.type}
                onChange={(e) => setEl("type", e.target.value)}
                // Roomy shares the line with Details, the pair filling the row.
                // Growing from their content widths rather than from nothing:
                // `flex: 1` would start both at zero and split the row evenly,
                // which cut "Judgment" off halfway.
                // 9 for "Principle", the longest of the three.
                style={{
                  ...sel,
                  ...pickerWidth(9),
                  ...(roomy ? { flex: "1 1 auto" } : null),
                }}
              >
                <option value="judgment">Judgment</option>
                <option value="principle">Principle</option>
                <option value="theory">Theory</option>
              </select>
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
                      value={elementForm.origin}
                      onChange={(e) => setEl("origin", e.target.value)}
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
              <select
                aria-label="Relation from"
                value={relationForm.from}
                onChange={(e) => setRel("from", e.target.value)}
                style={idSel}
              >
                <ElementOptions elements={elements} />
              </select>
              <span style={arrow}>→</span>
              <select
                aria-label="Relation type"
                value={relationForm.type}
                onChange={(e) => setRel("type", e.target.value)}
                // 10 for "undermines" and "depends on", the longest offered.
                style={{
                  ...linkSel,
                  ...pickerWidth(10),
                  color: C[relationForm.type],
                }}
              >
                <RelationTypeOptions />
              </select>
              <span style={arrow}>→</span>
              <select
                aria-label="Relation to"
                value={relationForm.to}
                onChange={(e) => setRel("to", e.target.value)}
                style={idSel}
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
                  <select
                    aria-label={`Premise ${i + 1}`}
                    value={premise}
                    onChange={(e) => setPremise(i, e.target.value)}
                    style={idSel}
                  >
                    <ElementOptions elements={elements} />
                  </select>
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
              <select
                aria-label="Argument type"
                value={negated ? "precludes" : "entails"}
                onChange={(e) =>
                  setArg("negated", e.target.value === "precludes")
                }
                // 9 for "precludes".
                style={{
                  ...linkSel,
                  ...pickerWidth(9),
                  color: negated ? C.precludes : C.entails,
                }}
              >
                <option value="entails">entails</option>
                <option value="precludes">precludes</option>
              </select>
              <span style={arrow}>→</span>
              <select
                aria-label="Conclusion"
                value={conclusion}
                onChange={(e) => setArg("conclusion", e.target.value)}
                style={idSel}
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
        {/* Last of all, and held against the far edge. It undoes the work the
            rest of the row is for, so it wants to be nowhere near the button
            that commits it — beside Add it read as a second way to submit. The
            fields between them grow, which is what carries it out there. */}
        <button
          onClick={resetTab}
          // Named for what it clears, as the submit button is: which tab is lit
          // is the only thing saying what either of them acts on.
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
          // `flex: 1` alone gives it whatever the controls leave over, which on
          // a phone is not much once the controls have wrapped onto three
          // lines. The floor is what makes it a field worth typing into.
          minHeight: roomy ? 130 : undefined,
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
