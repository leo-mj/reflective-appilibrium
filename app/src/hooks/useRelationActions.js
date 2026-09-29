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
  RELATION_EDIT_FIELDS,
  argumentRelationType,
  argumentRelationsOf,
  newArgumentId,
  nextElementId,
  rewordElement,
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

  /**
   * Saves the revise dialog. An argument step revises the whole argument, as
   * withdrawing one does: every premise takes the new type and explanation, so
   * the argument cannot end up with premises disagreeing about what they
   * establish, nor with an explanation on a row the card does not show.
   */
  const handleRelEditSave = (formData) => {
    const diffs = makeDiff(RELATION_EDIT_FIELDS, editingRel, formData);
    // Nothing changed, so nothing was revised — neither the relation nor, for
    // an argument step, every premise along with it.
    if (!diffs.length) {
      setEditingRel(null);
      return;
    }
    const newRound = state.round + 1;
    const argument = argumentRelationsOf(state.relations, editingRel);
    const revising = new Set(argument ?? [editingRel]);
    // A relation turned into entails or precludes is a one-premise argument
    // from then on, and needs an id of its own, as when one is added so.
    const argumentId =
      !editingRel.argumentId && ARGUMENT_RELATION_TYPES.has(formData.type)
        ? newArgumentId()
        : editingRel.argumentId;
    const revise = (r) => ({
      ...r,
      ...formData,
      ...(argumentId && { argumentId }),
      // The edit form has no Origin field, so any text change to a relation
      // that came from an LLM suggestion is auto-attributed as user-edited too.
      origin:
        formData.explanation !== r.explanation ? withUserEdit(r.origin) : r.origin,
      status: "revised",
      revisedRound: newRound,
      history: withEvent(r, {
        round: newRound,
        type: "revised",
        previousText: r.explanation,
      }),
    });
    const what = argument
      ? `Argument ${argument.map((r) => r.from).join(", ")} → ${editingRel.to}`
      : `Relation ${editingRel.from} → ${editingRel.to}`;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) => (revising.has(r) ? revise(r) : r)),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${what} was edited by the user.`,
          "Changes applied",
          diffs.join("; "),
        ),
      ],
    }));
    setEditingRel(null);
  };

  /**
   * Saves the argument dialog: premises swapped, reworded, taken out or added,
   * the conclusion swapped or reworded, and the argument's type and explanation
   * — all one step, one log entry and one undo.
   *
   * A line written as a new statement becomes an element. A line whose wording
   * was changed revises that element, everywhere it appears (`rewordElement`).
   * If the premises and the conclusion are the same elements as before, the
   * argument is revised in place, as `handleRelEditSave` does. If either
   * changed, the argument is **replaced**: its links are withdrawn at this step
   * and marked `supersededBy` a new argument carrying the new statements. That
   * is what lets History show the argument as it was before the step and as it
   * is after (stateUtils, isSupersededAt), where editing the links in place
   * would leave playback showing today's argument at every step.
   *
   * @param {{ premises: Array<{ id?: string, type?: string, text: string }>,
   *   conclusion?: { id?: string, type?: string, text: string },
   *   negated: boolean, explanation: string }} form
   */
  const handleArgumentRevise = ({
    premises,
    conclusion,
    negated,
    explanation,
  }) => {
    const argument = argumentRelationsOf(state.relations, editingRel);
    if (!argument) return;
    const first = argument[0];
    const step = state.round + 1;
    const byId = new Map(state.elements.map((e) => [e.id, e]));
    const lines = [...premises, ...(conclusion ? [conclusion] : [])];

    const added = [];
    const idOf = (p) => {
      if (p.id) return p.id;
      const id = nextElementId([...state.elements, ...added], p.type);
      added.push({
        id,
        type: p.type,
        text: p.text.trim(),
        confidence: 0.67,
        status: "active",
        origin: "user",
        addedRound: step,
      });
      return id;
    };
    const premiseIds = premises.map(idOf);
    const conclusionId = conclusion ? idOf(conclusion) : first.to;
    const reworded = new Map(
      lines
        .filter(
          (p) =>
            p.id && p.text.trim() && p.text.trim() !== byId.get(p.id)?.text,
        )
        .map((p) => [p.id, p.text.trim()]),
    );
    const oldIds = argument.map((r) => r.from);
    const samePremises =
      oldIds.length === premiseIds.length &&
      premiseIds.every((id) => oldIds.includes(id));
    // Another conclusion is another argument, as other premises are.
    const sameArgument = samePremises && conclusionId === first.to;
    const type = argumentRelationType(premiseIds.length, negated);
    const typeChanged = type !== first.type;
    const explanationChanged = explanation !== (first.explanation ?? "");

    // Nothing changed, so nothing was revised (as for any other dialog).
    if (sameArgument && !typeChanged && !explanationChanged && !reworded.size) {
      setEditingRel(null);
      return;
    }

    let relations;
    if (sameArgument && !typeChanged && !explanationChanged) {
      // Only wording changed, and that lives on the elements.
      relations = (prev) => prev;
    } else if (sameArgument) {
      const inArgument = new Set(argument);
      relations = (prev) =>
        prev.map((r) =>
          inArgument.has(r) && (typeChanged || explanationChanged)
            ? {
                ...r,
                type,
                explanation,
                origin: explanationChanged ? withUserEdit(r.origin) : r.origin,
                status: "revised",
                revisedRound: step,
                history: withEvent(r, {
                  round: step,
                  type: "revised",
                  previousText: r.explanation,
                }),
              }
            : r,
        );
    } else {
      const replacement = newArgumentId();
      const retired = new Set(argument);
      const origin = first.origin ? withUserEdit(first.origin) : "user";
      relations = (prev) => [
        ...prev.map((r) =>
          retired.has(r)
            ? {
                ...r,
                status: "withdrawn",
                supersededBy: replacement,
                history: withEvent(r, {
                  round: step,
                  type: "withdrawn",
                  reason: "Replaced by a revision of the argument.",
                }),
              }
            : r,
        ),
        ...premiseIds.map((from) => ({
          from,
          to: conclusionId,
          type,
          argumentId: replacement,
          explanation,
          origin,
          addedRound: step,
        })),
      ];
    }

    const changes = [
      ...(samePremises
        ? []
        : [`premises: ${oldIds.join(", ")} → ${premiseIds.join(", ")}`]),
      ...(conclusionId === first.to
        ? []
        : [`conclusion: ${first.to} → ${conclusionId}`]),
      ...added.map((e) => `${e.id} added`),
      ...[...reworded.keys()].map((id) => `${id} reworded`),
      ...(typeChanged ? [`type: ${first.type} → ${type}`] : []),
      ...(explanationChanged ? ["explanation revised"] : []),
    ];
    mutate((prev) => ({
      ...prev,
      round: step,
      elements: [
        ...prev.elements.map((e) =>
          reworded.has(e.id) ? rewordElement(e, reworded.get(e.id), step) : e,
        ),
        ...added,
      ],
      relations: relations(prev.relations),
      log: [
        ...prev.log,
        makeLogEntry(
          step,
          `Argument ${oldIds.join(", ")} → ${first.to} was revised by the user.`,
          "Changes applied",
          changes.join("; "),
        ),
      ],
    }));
    // The links a selection may have pointed at can be gone from view now.
    if (!sameArgument) setSelectedRel(null);
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

  /**
   * An argument written out rather than picked: each premise and the
   * conclusion is either a new element — added here, together with the
   * relations joining them — or `{ id }`, an element already on the board.
   *
   * One change rather than a run of adds, so it is one round, one log entry and
   * one undo — and so the ids are worked out against the whole element list,
   * `possible` ones included, which the add bar's own list leaves out.
   *
   * @typedef {{id: string} | {type: string, text: string, confidence: number}} ArgumentSlot
   * @param {{ premises: ArgumentSlot[], conclusion: ArgumentSlot,
   *   negated: boolean, explanation: string, origin: string }} formData
   */
  const handleAddNewArgument = ({
    premises,
    conclusion,
    negated,
    explanation,
    origin,
  }) => {
    const newRound = state.round + 1;
    const argumentId = newArgumentId();
    const type = argumentRelationType(premises.length, negated);
    const added = [];
    const add = (draft) => {
      if (draft.id) return draft.id;
      const id = nextElementId([...state.elements, ...added], draft.type);
      added.push({ id, status: "active", addedRound: newRound, origin, ...draft });
      return id;
    };
    const premiseIds = premises.map(add);
    const conclusionId = add(conclusion);
    const rels = premiseIds.map((from) => ({
      origin: "user",
      from,
      to: conclusionId,
      type,
      argumentId,
      explanation,
      addedRound: newRound,
    }));
    const arrow = `${premiseIds.join(", ")} → ${conclusionId}`;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: [...prev.elements, ...added],
      relations: [...prev.relations, ...rels],
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          added.length
            ? `Argument ${arrow} was added by the user, with ${added.map((e) => e.id).join(", ")}.`
            : `Argument ${arrow} was added by the user.`,
          "Added",
          [
            ...(added.length ? [`${added.map((e) => e.id).join(", ")} added`] : []),
            `${arrow} (${type}) added`,
          ].join("; "),
        ),
      ],
    }));
    setSelected(null);
    setSelectedRel(null);
    setRecentlyAddedRel(rels.at(-1));
    setRecentlyAdded(null);
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
    handleAddNewArgument,
    handleArgumentRevise,
    handleRejectRelations,
  };
}
