/**
 * @fileoverview Element-mutation handlers extracted from useREActions.
 * Receives shared state and setters from the compositor hook.
 * @module hooks/useElementActions
 */

import { useState } from "react";
import {
  nextElementId,
  makeDiff,
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

  const handleEditRequest = (elementId) => {
    setSelected(elementId);
    setEditingEl(state.elements.find((e) => e.id === elementId) ?? null);
  };

  const handleEditSave = (formData) => {
    const newRound = state.round + 1;
    const oldEl = editingEl;
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
    const diffs = makeDiff(
      ["type", "confidence", "status", "origin", "text"],
      oldEl,
      { ...formData, origin },
    );
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
          diffs.length ? diffs.join("; ") : "No fields changed",
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
        e.id === elementId
          ? {
              ...e,
              text: newText,
              origin: withUserEdit(e.origin),
              status: "revised",
              previousText: e.text,
              revisedRound: newRound,
              history: withEvent(e, {
                round: newRound,
                type: "revised",
                previousText: e.text,
              }),
            }
          : e,
      ),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          `${elementId} was reworded by the user while accepting an argument.`,
          "Changes applied",
          makeDiff(["text"], oldEl, { text: newText }).join("; "),
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

  const handleApplyRethonEquilibrium = (equilibriumIds) => {
    const newRound = state.round + 1;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      elements: prev.elements.map((e) => {
        if (e.status === "withdrawn" || e.status === "rejected") return e;
        if (equilibriumIds.has(e.id)) return e;
        return {
          ...e,
          status: "withdrawn",
          history: withEvent(e, { round: newRound, type: "withdrawn", reason: RETHON_REASON }),
          reason: RETHON_REASON,
        };
      }),
      log: [
        ...prev.log,
        makeLogEntry(
          newRound,
          "Rethon simulation applied: elements outside the equilibrium commitment set withdrawn.",
          "Applied rethon equilibrium",
          `Retained: ${[...equilibriumIds].join(", ")}`,
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
