/**
 * @fileoverview Mutation hook for all RE state changes.
 * Composes useElementActions and useRelationActions; owns undo, selection,
 * file import, and questionnaire logic.
 * @module hooks/useREActions
 */

import { useState, useRef } from "react";
import { importStateFromFile } from "../utils/importMarkdown.js";
import { useElementActions } from "./useElementActions.js";
import { useRelationActions } from "./useRelationActions.js";

/**
 * Owns the mutable RE state and all mutation handlers.
 * Selection state is included here because several add/edit handlers
 * need to update it as a side-effect of saving.
 *
 * @param {import('../types.js').REState} initialState
 */
export function useREActions(initialState) {
  const [state, setState] = useState(initialState);
  const undoStack = useRef([]);
  const MAX_UNDO = 20;
  const [undoCount, setUndoCount] = useState(0);

  const mutate = (updater) => {
    setState((prev) => {
      undoStack.current = [prev, ...undoStack.current].slice(0, MAX_UNDO);
      return updater(prev);
    });
    setUndoCount((n) => n + 1);
  };

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

  const handleUndo = () => {
    const prev = undoStack.current[0];
    if (!prev) return;
    undoStack.current = undoStack.current.slice(1);
    setUndoCount((n) => n - 1);
    setState(prev);
    if (selected && !prev.elements.some((e) => e.id === selected)) setSelected(null);
    if (selectedRel && !prev.relations.some((r) => r === selectedRel)) setSelectedRel(null);
  };
  const canUndo = undoCount > 0;

  const elementActions = useElementActions({
    state,
    mutate,
    selected,
    setSelected,
    setSelectedRel,
    setRecentlyAdded,
    setRecentlyAddedRel,
  });

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
    undoStack.current = [];
    setUndoCount(0);
    setState(newState);
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
    ...elementActions,
    ...relationActions,
    handleImportFile,
    handleQuestionnaireSelectAnswer,
  };
}
