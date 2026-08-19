/**
 * @fileoverview Mutation hook for all RE state changes.
 * Composes useElementActions and useRelationActions; owns undo, selection,
 * file import, and questionnaire logic.
 * @module hooks/useREActions
 */

import { useState, useReducer } from "react";
import { importStateFromFile } from "../utils/importMarkdown.js";
import { useElementActions } from "./useElementActions.js";
import { useGroupActions } from "./useGroupActions.js";
import { useRelationActions } from "./useRelationActions.js";
import { useReviewActions } from "./useReviewActions.js";

/** How many past states undo can reach back through. */
const MAX_UNDO = 20;

/**
 * The RE state, the states undo can return to, and the ones redo can return to.
 *
 * These are one value rather than a `useState` plus a `useRef` stack because
 * React may run a reducer — or a `setState` updater — more than once for a
 * single dispatch: StrictMode does it deliberately, and concurrent rendering
 * does it whenever an in-progress render is discarded and restarted. Pushing
 * onto a ref from inside an updater is therefore not safe; it used to record
 * two entries per edit under the StrictMode that `main.jsx` enables, so an
 * edit could survive being undone. A reducer is pure, so re-running it is
 * indistinguishable from running it once.
 *
 * @typedef {Object} REHistory
 * @property {import('../types.js').REState}   present
 * @property {import('../types.js').REState[]} past    Newest first, capped at MAX_UNDO.
 * @property {import('../types.js').REState[]} future  Nearest first; what undo took away.
 */

/**
 * @param {REHistory} hist
 * @param {{type: 'mutate', updater: Function} | {type: 'undo'} | {type: 'redo'} | {type: 'replace', state: Object}} action
 * @returns {REHistory}
 */
function historyReducer(hist, action) {
  switch (action.type) {
    // A new edit abandons the redo branch: the states it led to describe a
    // future that no longer follows from where the process now is.
    case "mutate":
      return {
        present: action.updater(hist.present),
        past: [hist.present, ...hist.past].slice(0, MAX_UNDO),
        future: [],
      };
    case "undo": {
      const [prev, ...rest] = hist.past;
      return prev
        ? { present: prev, past: rest, future: [hist.present, ...hist.future] }
        : hist;
    }
    case "redo": {
      const [next, ...rest] = hist.future;
      return next
        ? {
            present: next,
            past: [hist.present, ...hist.past].slice(0, MAX_UNDO),
            future: rest,
          }
        : hist;
    }
    // A freshly imported state is a new process, not a step in this one, so
    // neither undo nor redo may reach back across it.
    case "replace":
      return { present: action.state, past: [], future: [] };
    default:
      return hist;
  }
}

/**
 * Owns the mutable RE state and all mutation handlers.
 * Selection state is included here because several add/edit handlers
 * need to update it as a side-effect of saving.
 *
 * @param {import('../types.js').REState} initialState
 */
export function useREActions(initialState) {
  const [hist, dispatch] = useReducer(historyReducer, {
    present: initialState,
    past: [],
    future: [],
  });
  const state = hist.present;

  /**
   * Apply a pure `(prev) => next` update, recording the previous state for undo.
   * The updater must be free of side effects — see {@link REHistory}.
   */
  const mutate = (updater) => dispatch({ type: "mutate", updater });

  const [selected, setSelected] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);
  const [recentlyAdded, setRecentlyAdded] = useState(null);
  const [recentlyAddedRel, setRecentlyAddedRel] = useState(null);

  const handleSelectNode = (updater) => {
    setSelectedRel(null);
    setSelected(updater);
    setRecentlyAdded(null);
    setRecentlyAddedRel(null);
  };
  const handleSelectRel = (updater) => {
    setSelected(null);
    setSelectedRel(updater);
    setRecentlyAdded(null);
    setRecentlyAddedRel(null);
  };

  /** Drop a selection that the state being moved to no longer contains. */
  const reconcileSelection = (target) => {
    if (selected && !target.elements.some((e) => e.id === selected))
      setSelected(null);
    if (selectedRel && !target.relations.some((r) => r === selectedRel))
      setSelectedRel(null);
  };

  const handleUndo = () => {
    const prev = hist.past[0];
    if (!prev) return;
    dispatch({ type: "undo" });
    reconcileSelection(prev);
  };
  const canUndo = hist.past.length > 0;

  const handleRedo = () => {
    const next = hist.future[0];
    if (!next) return;
    dispatch({ type: "redo" });
    reconcileSelection(next);
  };
  const canRedo = hist.future.length > 0;

  const elementActions = useElementActions({
    state,
    mutate,
    selected,
    setSelected,
    setSelectedRel,
    setRecentlyAdded,
    setRecentlyAddedRel,
  });

  const groupActions = useGroupActions({
    state,
    mutate,
    setSelected,
    setSelectedRel,
  });

  const reviewActions = useReviewActions({ state, mutate });

  const relationActions = useRelationActions({
    state,
    mutate,
    selectedRel,
    setSelected,
    setSelectedRel,
    setRecentlyAddedRel,
    setRecentlyAdded,
  });

  const handleImportFile = async (file) => {
    const newState = await importStateFromFile(file);
    dispatch({ type: "replace", state: newState });
    setSelected(null);
    setSelectedRel(null);
  };

  /**
   * Records the user's answer to a questionnaire and propagates conclusion
   * activations throughout the arguments behind the questionnaire (must be pre-set).
   *
   * 1. Activates `selectedId` and resets unchosen `siblingIds` to `"possible"`.
   * 2. Rebuilds a questionnaireIndex → element lookup over the updated element list.
   * 3. Checks every argument in the questionnaire whose conclusion is a
   *    pure-conclusion element: if all premises
   *    are now `"active"`, the conclusion is activated; otherwise it stays/becomes
   *    `"possible"`.
   *
   * @param {string}   selectedId  - Element id of the chosen answer.
   * @param {string[]} siblingIds  - Element ids of the unchosen answers for the same question.
   */
  const handleQuestionnaireSelectAnswer = (selectedId, siblingIds) => {
    mutate((prev) => {
      const allArgs = [
        ...prev.questionnaireSpec.participantArguments,
        ...prev.questionnaireSpec.furtherArguments,
      ];
      const premiseIndices = new Set(allArgs.flatMap((arg) => arg.slice(0, -1).map(Math.abs)));
      const conclusionIndices = new Set(
        allArgs.map((arg) => Math.abs(arg.at(-1))).filter((i) => !premiseIndices.has(i))
      );

      const updated = prev.elements.map((el) => {
        if (el.id === selectedId) return { ...el, status: "active" };
        if (siblingIds.includes(el.id)) return { ...el, status: "possible" };
        return el;
      });

      const lookup = {};
      for (const el of updated) if (el.questionnaireIndex != null) lookup[el.questionnaireIndex] = el;

      const shouldBeActive = new Set();
      for (const arg of allArgs) {
        if (!arg.every((n) => lookup[Math.abs(n)] != null)) continue;
        const conclusionIdx = Math.abs(arg.at(-1));
        if (!conclusionIndices.has(conclusionIdx)) continue;
        if (arg.slice(0, -1).every((n) => lookup[Math.abs(n)]?.status === "active")) {
          shouldBeActive.add(conclusionIdx);
        }
      }

      return {
        ...prev,
        elements: updated.map((el) => {
          if (!conclusionIndices.has(el.questionnaireIndex)) return el;
          const active = shouldBeActive.has(el.questionnaireIndex);
          return { ...el, status: active ? "active" : "possible" };
        }),
      };
    });
  };

  return {
    state,
    selected,
    selectedRel,
    recentlyAdded,
    recentlyAddedRel,
    handleSelectNode,
    handleSelectRel,
    handleUndo,
    canUndo,
    handleRedo,
    canRedo,
    ...elementActions,
    ...relationActions,
    ...groupActions,
    ...reviewActions,
    handleImportFile,
    handleQuestionnaireSelectAnswer,
  };
}
