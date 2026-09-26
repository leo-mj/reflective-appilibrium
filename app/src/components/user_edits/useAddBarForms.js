/**
 * @fileoverview The add bar's three forms — element, relation, argument — and
 * what the bar does with them: which one is on show, how a graph selection or
 * the tab the bar sits under fills them in, whether the one on show can be
 * added, and adding it.
 *
 * All three are held here rather than by the fields that draw them, because
 * they outlive those fields: a half-written element survives a look at the
 * argument tab, and a node selected in the graph fills the relation and the
 * argument form alike, whichever is on show.
 *
 * @module components/user_edits/useAddBarForms
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";

import { originOrDefault, useLastOrigin } from "../../utils/lastOrigin.js";
import {
  argumentRelationType,
  defaultPickerIds,
  newArgumentId,
  sortElementIds,
} from "../../utils/stateUtils.js";
import {
  checkPickedArgument,
  checkRelation,
  checkWrittenArgument,
  makeArgumentDefaults,
  makeRelationDefaults,
  WRITTEN_ARGUMENT_DEFAULTS,
} from "./addPanelShared.js";

// Origin is deliberately not among them: it is who is adding rather than part
// of the element being written, and so is kept across a clear, an add and a tab
// change alike. See {@link module:utils/lastOrigin}.
const ELEMENT_DEFAULTS = {
  type: "judgment",
  confidence: 0.67,
  text: "",
};

/**
 * One of the three forms, as the bar around its fields needs it — so the bar
 * asks the form on show rather than asking which tab is lit.
 *
 * @typedef {Object} BarForm
 * @property {{valid: boolean, complaint: string|null}} check - Whether Add
 *   works, and why not where that is worth saying.
 * @property {string} text - The bar's one text field: a statement, or an
 *   explanation.
 * @property {function(string): void} setText
 * @property {string} placeholder
 * @property {function(): void} submit
 * @property {function(): void} reset - Back to how the form started.
 */

/**
 * @param {Object}      args
 * @param {REElement[]} args.elements
 * @param {string|null} [args.selected]
 * @param {string[]|null} [args.ctrlChain]
 * @param {Object|null} args.preset
 * @param {boolean}     args.showRelations - Whether the relation tab is offered.
 * @param {function}    args.onAddElement
 * @param {function}    args.onAddRelation
 * @param {function}    [args.onAddNewArgument]
 *
 * The props of {@link module:components/user_edits/AddBar.AddBar}, which says
 * what each one is.
 */
export function useAddBarForms({
  elements,
  selected,
  ctrlChain,
  preset,
  showRelations,
  onAddElement,
  onAddRelation,
  onAddNewArgument,
}) {
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
  // An argument's premises and conclusion are either picked from the board in
  // one compact row, or stacked a line each, where every line is written out
  // new or taken from the board. The stack opens by default, since it covers
  // both; picking is where a ctrl+click chain lands.
  const [argumentMode, setArgumentMode] = useState("write");
  const [writtenForm, setWrittenForm] = useState(WRITTEN_ARGUMENT_DEFAULTS);
  const writing = !!onAddNewArgument && argumentMode === "write";

  // The relation tab can be taken away underneath a reader standing on it, by
  // the setting flipping while the bar is open. Derived rather than corrected
  // in state, so the tab they were on is still there if it comes back.
  const tab =
    !showRelations && activeTab === "relation" ? "argument" : activeTab;
  /** The tab a graph selection fills in — the only kind of link on offer. */
  const linkTab = showRelations ? "relation" : "argument";

  // The tab the bar is under says what is about to be added, where it has a
  // view — see {@link module:constants/tabConstants.ADD_BAR_PRESETS}. Applied
  // when the preset changes rather than on every render, by the same trackers
  // the graph selection uses below and for a sharper reason: forced every
  // render, neither the tab buttons nor the type picker could be moved off it
  // at all. Changing means a different object, hence the frozen constants.
  //
  // Before the selection, so that a node picked in the assist tab's own graph
  // still carries the bar over to a link tab: arriving on the tab is the older
  // of the two events, and the reader's click is what happened since.
  const [prevPreset, setPrevPreset] = useState(null);
  if (preset !== prevPreset) {
    setPrevPreset(preset);
    if (preset) {
      setActiveTab(preset.tab);
      if (preset.elementType)
        setElementForm((prev) => ({ ...prev, type: preset.elementType }));
    }
  }

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

  // A ctrl+click chain is the whole link, not its far end: the canvas draws
  // `P5, P4, P1 → J7` under a three-click selection, and the bar is meant to be
  // holding that argument — the same premises, in the same order. It used to be
  // handed the newest id alone, which left the bar showing the first premise and
  // the last conclusion, an argument nobody had asked for.
  //
  // Read the way the graph's own chip reads it: the last is the conclusion, the
  // rest are the premises. The relation form takes the two ends of it, a
  // relation being binary — and the graph only offers one for a chain of two.
  const [prevChain, setPrevChain] = useState(null);
  if (ctrlChain !== prevChain) {
    setPrevChain(ctrlChain);
    if (ctrlChain && ctrlChain.length > 1) {
      const conclusion = ctrlChain.at(-1);
      setActiveTab((t) => (t === "element" ? linkTab : t));
      setRelationForm((prev) => ({
        ...prev,
        from: ctrlChain[0],
        to: conclusion,
      }));
      setArgumentForm((prev) => ({
        ...prev,
        premises: ctrlChain.slice(0, -1),
        conclusion,
      }));
      // A chain is a deliberate pick of existing elements, so it is shown as
      // one. A plain selection is not, and leaves a half-written argument be.
      setArgumentMode("pick");
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
    // In play first, then anything else linkable. The fallback matters where
    // few elements are in play: the only free one may be withdrawn or rejected,
    // and appending a duplicate would only disable the add button. This was the
    // assist panel's rule and not the strip's, which is one of the two places
    // the two argument forms had drifted — the strip reached the whole pool but
    // would hand over a withdrawn element while an active one stood free.
    const taken = new Set([...premises, conclusion]);
    const free = (list) => list.find((id) => !taken.has(id));
    setArg("premises", [
      ...premises,
      free(defaultPickerIds(elements)) ?? free(ids) ?? "",
    ]);
  };
  const removePremise = (i) =>
    setArg(
      "premises",
      premises.filter((_, j) => j !== i),
    );

  const addWrittenArgument = () => {
    // A line taken from the board goes by its id. A written one is a new
    // element: added at the element tab's default confidence and under the
    // same origin, since it is the same reader adding it.
    const draft = ({ id, type, text }) =>
      id
        ? { id }
        : {
            type,
            text: text.trim(),
            confidence: ELEMENT_DEFAULTS.confidence,
          };
    onAddNewArgument({
      premises: writtenForm.premises.map(draft),
      conclusion: draft(writtenForm.conclusion),
      negated,
      explanation: argumentForm.explanation,
      origin: originOrDefault(origin),
    });
  };

  const addPickedArgument = () => {
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
  };

  /** @type {Record<string, BarForm>} */
  const forms = {
    element: {
      check: { valid: elementForm.text.trim().length > 0, complaint: null },
      text: elementForm.text,
      setText: (v) => setEl("text", v),
      placeholder: "Enter statement…",
      submit: () =>
        onAddElement({ ...elementForm, origin: originOrDefault(origin) }),
      reset: () => setElementForm(ELEMENT_DEFAULTS),
    },
    relation: {
      check: checkRelation(relationForm, ids.length),
      text: relationForm.explanation,
      setText: (v) => setRel("explanation", v),
      placeholder: "Explanation (optional)…",
      submit: () => onAddRelation(relationForm),
      reset: () => setRelationForm(makeRelationDefaults(elements)),
    },
    argument: {
      check: writing
        ? checkWrittenArgument(writtenForm, new Set(ids))
        : checkPickedArgument(argumentForm, ids.length),
      text: argumentForm.explanation,
      setText: (v) => setArg("explanation", v),
      placeholder: negated
        ? "Why do these premises preclude the conclusion? (optional)"
        : "Why do these premises entail the conclusion? (optional)",
      submit: writing ? addWrittenArgument : addPickedArgument,
      // One premise again, in the case of an argument that has grown several.
      reset: () => {
        setArgumentForm(makeArgumentDefaults(elements));
        setWrittenForm(WRITTEN_ARGUMENT_DEFAULTS);
      },
    },
  };
  const form = forms[tab];
  const canSubmit = form.check.valid;

  /**
   * Adding leaves the form as it started, which is also what Clear does: Clear
   * is "as if you had just added one", not a separate idea of what empty means.
   */
  const handleSubmit = () => {
    form.submit();
    form.reset();
  };

  /**
   * Clear is a reset plus a new field. Submitting is not: it leaves the reader
   * where they were, and after a ctrl-enter that is inside the field they are
   * still typing in — replacing it there would take the focus with it.
   */
  const handleClear = () => {
    form.reset();
    setGeneration((n) => n + 1);
  };

  /** Every field in the bar submits on ctrl-enter. */
  const submitOnCtrlEnter = (e) => {
    // metaKey too: on a Mac the shortcut people reach for is cmd-enter, and the
    // app's own undo already answers to both.
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return {
    tab,
    setActiveTab,
    form,
    canSubmit,
    handleSubmit,
    handleClear,
    submitOnCtrlEnter,
    generation,
    origin,
    elementForm,
    setEl,
    relationForm,
    setRel,
    argumentForm,
    setArg,
    argumentMode,
    setArgumentMode,
    writing,
    writtenForm,
    setWrittenForm,
    setPremise,
    addPremise,
    removePremise,
    canAddPremise: ids.length > premises.length + 1,
  };
}
