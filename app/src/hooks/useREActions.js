/**
 * @fileoverview Mutation hook for all RE state changes.
 * @module hooks/useREActions
 */

import { useState, useRef } from "react";
import { nextElementId, makeDiff, makeLogEntry } from "../utils/stateUtils.js";
import { importStateFromFile } from "../utils/importMarkdown.js";

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

  const [editingEl, setEditingEl] = useState(null);
  const [editingRel, setEditingRel] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);
  const [withdrawingId, setWithdrawingId] = useState(null);
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

  const handleRelEditSave = (formData) => {
    const newRound = state.round + 1;
    const diffs = makeDiff(["type", "explanation"], editingRel, formData);
    mutate((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) =>
        r === editingRel
          ? { ...editingRel, ...formData, status: "revised", revisedRound: newRound }
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

  const handleWithdrawRelRequest = (rel) => {
    const newRound = state.round + 1;
    const isArgRel = (rel.type === "jointly_entails" || rel.type === "jointly_precludes") && rel.argumentId;
    mutate((prev) => ({
      ...prev,
      round: newRound,
      relations: prev.relations.map((r) => {
        const inGroup = isArgRel && r.argumentId === rel.argumentId && (r.type === "jointly_entails" || r.type === "jointly_precludes");
        return r === rel || inGroup
          ? { ...r, status: "withdrawn", withdrawnRound: newRound }
          : r;
      }),
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

  const handleDeleteRelationsByArgId = (argumentId) => {
    mutate((prev) => ({
      ...prev,
      relations: prev.relations.filter(
        (r) => !(r.argumentId === argumentId && (r.type === "jointly_entails" || r.type === "jointly_precludes")),
      ),
    }));
    if (selectedRel?.argumentId === argumentId) setSelectedRel(null);
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

  const handleAddRelation = (formData, { select = true, pinRecent = false } = {}) => {
    const newRound = state.round + 1;
    const newRel = { ...formData, addedRound: newRound };
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

  const handleImportFile = async (file) => {
    const newState = await importStateFromFile(file);
    undoStack.current = [];
    setUndoCount(0);
    setState(newState);
    setSelected(null);
    setSelectedRel(null);
  };

  return {
    state,
    selected,
    selectedRel,
    recentlyAdded,
    recentlyAddedRel,
    handleSelectNode,
    handleSelectRel,
    editingEl,
    setEditingEl,
    handleEditRequest,
    handleEditSave,
    editingRel,
    setEditingRel,
    handleRelEditSave,
    handleWithdrawRequest,
    handleWithdrawConfirm,
    withdrawingId,
    setWithdrawingId,
    handleWithdrawRelRequest,
    handleDeleteRelationsByArgId,
    handleAddElement,
    handleAddRelation,
    handleRejectElements,
    handleRejectRelations,
    handleApplyRethonEquilibrium,
    handleImportFile,
    handleUndo,
    canUndo,
  };
}
