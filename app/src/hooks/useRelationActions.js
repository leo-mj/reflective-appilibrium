/**
 * @fileoverview Relation-mutation handlers extracted from useREActions.
 * Receives shared state and setters from the compositor hook.
 * @module hooks/useRelationActions
 */

/** @import { RERelation } from '../types.js' */

import { useState } from "react";
import {
  makeDiff,
  makeLogEntry,
  ARGUMENT_RELATION_TYPES,
  newArgumentId,
  withEvent,
  withUserEdit,
} from "../utils/stateUtils.js";

/**
 * @param {{ state, mutate, selectedRel, setSelected, setSelectedRel, setRecentlyAddedRel, setRecentlyAdded }} deps
 */
export function useRelationActions({
  state,
  mutate,
  selectedRel,
  setSelected,
  setSelectedRel,
  setRecentlyAddedRel,
  setRecentlyAdded,
}) {
  const [editingRel, setEditingRel] = useState(null);

  const handleRelEditSave = (formData) => {
    const newRound = state.round + 1;
    // The edit form has no Origin field, so any text change to a relation
    // that came from an LLM suggestion is auto-attributed as user-edited too.
    const textChanged = formData.explanation !== editingRel.explanation;
    const origin = textChanged
      ? withUserEdit(editingRel.origin)
      : editingRel.origin;
    const diffs = makeDiff(["type", "explanation"], editingRel, formData);
    mutate((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) =>
        r === editingRel
          ? {
              ...editingRel,
              ...formData,
              origin,
              status: "revised",
              revisedRound: newRound,
              history: withEvent(editingRel, {
                round: newRound,
                type: "revised",
                previousText: editingRel.explanation,
              }),
            }
          : r,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `Relation ${editingRel.from} → ${editingRel.to} was edited by the user.`,
          "Changes applied",
          diffs.length ? diffs.join("; ") : "No fields changed",
        ),
      ],
    }));
    setEditingRel(null);
  };

  /**
   * Relations belonging to one argument are withdrawn and reinstated together:
   * half an argument is not an argument.
   *
   * @param {RERelation} rel
   * @param {RERelation} candidate
   * @param {boolean}    isArgRel
   */
  const inSameArgument = (rel, candidate, isArgRel) =>
    candidate === rel ||
    (isArgRel &&
      candidate.argumentId === rel.argumentId &&
      ARGUMENT_RELATION_TYPES.has(candidate.type));

  const handleWithdrawRelRequest = (rel) => {
    const newRound = state.round + 1;
    const isArgRel = ARGUMENT_RELATION_TYPES.has(rel.type) && rel.argumentId;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) =>
        inSameArgument(rel, r, isArgRel)
          ? {
              ...r,
              status: "withdrawn",
              history: withEvent(r, { round: newRound, type: "withdrawn" }),
            }
          : r,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          isArgRel
            ? `Argument (${rel.argumentId}) withdrawn by the user.`
            : `Relation ${rel.from} → ${rel.to} was withdrawn by the user.`,
          "Withdrawn",
          isArgRel
            ? `All argument relations of ${rel.argumentId}: status → withdrawn`
            : `${rel.from} → ${rel.to}: status → withdrawn`,
        ),
      ],
    }));
    if (isArgRel ? selectedRel?.argumentId === rel.argumentId : selectedRel === rel)
      setSelectedRel(null);
  };

  /**
   * Brings a withdrawn relation — or every relation of a withdrawn argument —
   * back into play, recorded as an event so history still shows the rounds it
   * was absent.
   *
   * @param {RERelation} rel
   */
  const handleReinstateRelation = (rel) => {
    if (rel.status !== "withdrawn") return;
    const newRound = state.round + 1;
    const isArgRel = ARGUMENT_RELATION_TYPES.has(rel.type) && rel.argumentId;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) =>
        inSameArgument(rel, r, isArgRel) && r.status === "withdrawn"
          ? {
              ...r,
              status: "active",
              history: withEvent(r, { round: newRound, type: "reinstated" }),
            }
          : r,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          isArgRel
            ? `Argument (${rel.argumentId}) was reinstated by the user.`
            : `Relation ${rel.from} → ${rel.to} was reinstated by the user.`,
          "Reinstated",
          isArgRel
            ? `All argument relations of ${rel.argumentId}: status → active`
            : `${rel.from} → ${rel.to}: status → active`,
        ),
      ],
    }));
  };

  const handleDeleteRelationsByArgId = (argumentId) => {
    mutate((prev) => ({
      ...prev,
      relations: prev.relations.filter(
        (r) => !(r.argumentId === argumentId && ARGUMENT_RELATION_TYPES.has(r.type)),
      ),
    }));
    if (selectedRel?.argumentId === argumentId) setSelectedRel(null);
  };

  const handleAddRelation = (formData, { select = true, pinRecent = false } = {}) => {
    const newRound = state.round + 1;
    // Manual add UIs (graph modals, TextTab bar, workflow panels) don't expose
    // an Origin field, so default to "user"; LLM-driven callers (RelationSuggestTab,
    // DetectArgumentsTab) already pass their own origin in formData.
    const newRel = { origin: "user", ...formData, addedRound: newRound };
    // Argument relations are grouped by argumentId. The argument panels supply
    // their own so joint premises share one; a relation form that happens to
    // pick entails/precludes is a one-premise argument and needs its own.
    if (ARGUMENT_RELATION_TYPES.has(newRel.type) && !newRel.argumentId) {
      newRel.argumentId = newArgumentId();
    }
    mutate((prev) => ({
      ...prev,
      round: newRound,
      relations: [...prev.relations, newRel],
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `Relation ${formData.from} → ${formData.to} was added by the user.`,
          "Added",
          `${formData.from} → ${formData.to} (${formData.type}) added`,
        ),
      ],
    }));
    if (select) {
      setSelected(null);
      setSelectedRel(null);
      setRecentlyAddedRel(newRel);
      setRecentlyAdded(null);
    } else if (pinRecent) {
      setRecentlyAddedRel(newRel);
      setRecentlyAdded(null);
    }
  };

  const handleRejectRelations = (formDatas) => {
    mutate((prev) => ({
      ...prev,
      relations: [
        ...prev.relations,
        ...formDatas.map((fd) => ({
          ...fd,
          status: "rejected",
          addedRound: prev.round,
          rejectedRound: prev.round,
          history: [{ round: prev.round, type: "rejected" }],
        })),
      ],
      log: [
        ...prev.log,
        makeLogEntry(
          prev.round,
          `${formDatas.length} relation suggestion${formDatas.length !== 1 ? "s" : ""} rejected.`,
          "Rejected",
          formDatas.map((fd) => `${fd.from} → ${fd.to} (${fd.type})`).join("; "),
        ),
      ],
    }));
  };

  return {
    editingRel,
    setEditingRel,
    handleRelEditSave,
    handleWithdrawRelRequest,
    handleReinstateRelation,
    handleDeleteRelationsByArgId,
    handleAddRelation,
    handleRejectRelations,
  };
}
