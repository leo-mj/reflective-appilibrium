/**
 * @fileoverview Element-mutation handlers extracted from useREActions.
 * Receives shared state and setters from the compositor hook.
 * @module hooks/useElementActions
 */

import { useState } from "react";
import { nextElementId, makeDiff, makeLogEntry } from "../utils/stateUtils.js";

/**
 * @param {{ state, mutate, selected, setSelected, setSelectedRel, setRecentlyAdded, setRecentlyAddedRel }} deps
 */
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
    // eslint-disable-next-line no-unused-vars
    const { withdrawnRound, reason, ...oldElBase } = oldEl;
    const newEl = {
      ...oldElBase,
      ...formData,
      status: "revised",
      previousText: oldEl.text,
      revisedRound: newRound,
    };
    const diffs = makeDiff(
      ["type", "confidence", "status", "origin", "text"],
      oldEl,
      formData,
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
              withdrawnRound: newRound,
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

  const handleRejectElements = (formDatas) => {
    mutate((prev) => {
      let running = prev.elements;
      const newEls = formDatas.map((fd) => {
        const id = nextElementId(running, fd.type);
        const el = { id, status: "rejected", addedRound: prev.round, rejectedRound: prev.round, ...fd };
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
          withdrawnRound: newRound,
          reason: "Withdrawn by rethon equilibrium simulation.",
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
    handleWithdrawRequest,
    handleWithdrawConfirm,
    handleAddElement,
    handleRejectElements,
    handleApplyRethonEquilibrium,
  };
}
