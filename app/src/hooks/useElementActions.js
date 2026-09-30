/**
 * @fileoverview Element-mutation handlers extracted from useREActions.
 * Receives shared state and setters from the compositor hook.
 * @module hooks/useElementActions
 */

import { useState } from "react";
import {
  ELEMENT_EDIT_FIELDS,
  rewordElement,
  nextElementId,
  makeDiff,
  editChanges,
  makeLogEntry,
  historyOf,
  isWithdrawnNow,
  withEvent,
  withUserEdit,
} from "../utils/stateUtils.js";

/**
 * @param {{ state, mutate, selected, setSelected, setSelectedRel, setRecentlyAdded, setRecentlyAddedRel }} deps
 */
const RETHON_REASON = "Withdrawn by rethon equilibrium simulation.";
const RETHON_REJECT_REASON =
  "Rejected by rethon equilibrium simulation: the equilibrium holds its negation.";

/** A simulation run as the log records it: enough to run it again. */
function describeRun({ depth, weights, from, to }) {
  const w = (x) => x.toFixed(2);
  return [
    `depth ${depth}`,
    `weights: account ${w(weights.account)}, systematicity ${w(weights.systematicity)}, faithfulness ${w(weights.faithfulness)}`,
    from != null && to != null
      ? `achievement ${from.toFixed(3)} → ${to.toFixed(3)}`
      : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function useElementActions({
  state,
  mutate,
  selected,
  setSelected,
  setSelectedRel,
  setRecentlyAdded,
  setRecentlyAddedRel,
}) {
  const [editingEl, setEditingEl] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);

  /**
   * Opens the revise modal on an element.
   *
   * Deliberately leaves the selection alone. Selection is the user's own
   * pointer — clicking a node or a text card — and it dims everything it is not
   * connected to; revising from a card three screens down the list would
   * otherwise silently re-focus the graph on an element the user never picked.
   *
   * @param {string} elementId
   */
  const handleEditRequest = (elementId) => {
    setEditingEl(state.elements.find((e) => e.id === elementId) ?? null);
  };

  const handleEditSave = (formData) => {
    const oldEl = editingEl;
    // Nothing changed, so nothing was revised: no round, no status, no log.
    if (!makeDiff(ELEMENT_EDIT_FIELDS, oldEl, formData).length) {
      setEditingEl(null);
      return;
    }
    const newRound = state.round + 1;
    /* eslint-disable-next-line no-unused-vars */
    const { withdrawnRound, reinstatedRound, withdrawals, reason, ...oldElBase } =
      oldEl;
    // Revising a withdrawn element brings it back, so record that too rather
    // than silently dropping the withdrawal as the legacy fields did.
    const history = [
      ...historyOf(oldEl),
      ...(isWithdrawnNow(oldEl) ? [{ round: newRound, type: "reinstated" }] : []),
      { round: newRound, type: "revised", previousText: oldEl.text },
    ];
    // If the text actually changed and the user didn't touch the Origin
    // field themselves, mark an LLM-authored origin as also user-edited
    // rather than silently keeping "llm" for text the user rewrote.
    const textChanged = formData.text !== oldEl.text;
    const originTouchedByUser = formData.origin !== oldEl.origin;
    const origin =
      textChanged && !originTouchedByUser
        ? withUserEdit(oldEl.origin)
        : formData.origin;
    const newEl = {
      ...oldElBase,
      ...formData,
      origin,
      status: "revised",
      previousText: oldEl.text,
      revisedRound: newRound,
      history,
    };
    const diffs = makeDiff(ELEMENT_EDIT_FIELDS, oldEl, { ...formData, origin });
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) => (e.id === oldEl.id ? newEl : e)),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${oldEl.id} was edited by the user.`,
          "Changes applied",
          editChanges(oldEl.id, diffs),
        ),
      ],
    }));
    setEditingEl(null);
  };

  /**
   * Reword one existing element in place, without going through the edit modal.
   *
   * Detect Arguments needs this: a user reviewing a reconstruction may find that
   * an existing premise has to be reworded before the argument goes through, and
   * that edit has to land on the element already in the state rather than create
   * a new one. Records the same bookkeeping as `handleEditSave` — previousText,
   * revisedRound, and a user-edited origin — so a rewording reached this way is
   * indistinguishable in the history from one made in the editor.
   *
   * @param {string} elementId
   * @param {string} newText
   */
  const handleReviseElementText = (elementId, newText) => {
    const oldEl = state.elements.find((e) => e.id === elementId);
    if (!oldEl || newText === oldEl.text) return;
    const newRound = state.round + 1;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) =>
        e.id === elementId ? rewordElement(e, newText, newRound) : e,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${elementId} was reworded by the user while accepting an argument.`,
          "Changes applied",
          editChanges(elementId, makeDiff(["text"], oldEl, { text: newText })),
        ),
      ],
    }));
  };

  const handleWithdrawRequest = (elementId) => {
    setWithdrawingId(elementId);
  };

  const handleWithdrawConfirm = (elementId, reason) => {
    const newRound = state.round + 1;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) =>
        e.id === elementId
          ? {
              ...e,
              status: "withdrawn",
              history: withEvent(e, { round: newRound, type: "withdrawn", reason: reason ?? "" }),
              reason: reason ?? "",
              previousText: undefined,
              revisedRound: undefined,
            }
          : e,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${elementId} was withdrawn by the user.`,
          "Withdrawn",
          `${elementId}: status → withdrawn`,
        ),
      ],
    }));
    setWithdrawingId(null);
    if (selected === elementId) setSelected(null);
  };

  const handleAddElement = (formData) => {
    const newRound = state.round + 1;
    const newId = nextElementId(state.elements, formData.type);
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: [
        ...prev.elements,
        { id: newId, status: "active", addedRound: newRound, ...formData },
      ],
      log: [
        ...prev.log,
        makeLogEntry(newRound, `${newId} was added by the user.`, "Added", `${newId} added`),
      ],
    }));
    setSelected(null);
    setSelectedRel(null);
    setRecentlyAdded(newId);
    setRecentlyAddedRel(null);
  };

  /**
   * Brings a withdrawn or rejected element back into play — the counterpart to
   * withdrawing and rejecting, and what makes an argument built on such an
   * element worth building.
   *
   * Recorded as an event rather than by erasing the withdrawal, so history
   * playback still shows the element as absent for the rounds it was gone, and
   * any number of withdraw/reinstate cycles survives.
   *
   * @param {string} elementId
   */
  const handleReinstateElement = (elementId) => {
    const el = state.elements.find((e) => e.id === elementId);
    if (!el || !["withdrawn", "rejected"].includes(el.status)) return;
    const newRound = state.round + 1;
    const wasRejected = el.status === "rejected";
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) =>
        e.id === elementId
          ? {
              ...e,
              status: "active",
              reason: undefined,
              history: withEvent(e, { round: newRound, type: "reinstated" }),
            }
          : e,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${elementId} was ${wasRejected ? "rejected" : "withdrawn"} earlier and has been reinstated by the user.`,
          "Reinstated",
          `${elementId}: status → active`,
        ),
      ],
    }));
  };

  const handleRejectElements = (formDatas) => {
    mutate((prev) => {
      let running = prev.elements;
      const newEls = formDatas.map((fd) => {
        const id = nextElementId(running, fd.type);
        const el = {
          id,
          status: "rejected",
          addedRound: prev.round,
          rejectedRound: prev.round,
          history: [{ round: prev.round, type: "rejected" }],
          ...fd,
        };
        running = [...running, el];
        return el;
      });
      return {
        ...prev,
        elements: [...prev.elements, ...newEls],
        log: [
          ...prev.log,
          makeLogEntry(
            prev.round,
            `${formDatas.length} suggestion${formDatas.length !== 1 ? "s" : ""} rejected.`,
            "Rejected",
            formDatas.map((fd) => fd.text).join("; "),
          ),
        ],
      };
    });
  };

  /**
   * Takes up a simulated position, as one step: withdraws, takes up again and
   * rejects what `positionChanges` (utils/simulationDiff.js) says it would.
   * The Simulate tab hands over that same record, so what is applied is what
   * the tab listed and the graph previewed.
   *
   * The entry's sentence records the run — depth, weights, and achievement
   * before and after — so that a result taken up can be reproduced from the
   * log alone; the export carries it.
   *
   * @param {{ withdraw: string[], takeUp: string[], reject: string[],
   *   run?: { depth: number, weights: {account: number, systematicity: number, faithfulness: number}, from?: number, to?: number } }} changes
   */
  const handleApplyRethonEquilibrium = ({ withdraw, takeUp, reject, run }) => {
    if (withdraw.length + takeUp.length + reject.length === 0) return;
    const newRound = state.round + 1;
    const withdrawing = new Set(withdraw);
    const takingUp = new Set(takeUp);
    const rejecting = new Set(reject);
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) => {
        if (withdrawing.has(e.id))
          return {
            ...e,
            status: "withdrawn",
            history: withEvent(e, { round: newRound, type: "withdrawn", reason: RETHON_REASON }),
            reason: RETHON_REASON,
          };
        if (takingUp.has(e.id))
          return {
            ...e,
            status: "active",
            reason: undefined,
            history: withEvent(e, { round: newRound, type: "reinstated" }),
          };
        if (rejecting.has(e.id))
          return {
            ...e,
            status: "rejected",
            history: withEvent(e, { round: newRound, type: "rejected", reason: RETHON_REJECT_REASON }),
            reason: RETHON_REJECT_REASON,
          };
        return e;
      }),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          run ? `Rethon simulation applied (${describeRun(run)}).` : "Rethon simulation applied.",
          "Applied rethon equilibrium",
          [
            withdraw.length && `Withdrawn: ${withdraw.join(", ")}`,
            takeUp.length && `Taken up again: ${takeUp.join(", ")}`,
            reject.length && `Rejected: ${reject.join(", ")}`,
          ]
            .filter(Boolean)
            .join(". "),
        ),
      ],
    }));
  };

  return {
    editingEl,
    setEditingEl,
    withdrawingId,
    setWithdrawingId,
    handleEditRequest,
    handleEditSave,
    handleReviseElementText,
    handleWithdrawRequest,
    handleWithdrawConfirm,
    handleReinstateElement,
    handleAddElement,
    handleRejectElements,
    handleApplyRethonEquilibrium,
  };
}
