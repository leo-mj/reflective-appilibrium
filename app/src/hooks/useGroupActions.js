/**
 * @fileoverview Group-mutation handlers, composed into useREActions.
 *
 * Grouping is a view operation, so — unlike every handler in
 * {@link module:hooks/useElementActions} — none of these advance the round or
 * write a log entry. The log is the record of the RE process: what was
 * accepted, revised, withdrawn and why. Bracketing four nodes to stop them
 * cluttering the canvas is none of those things, and a round in the log saying
 * so would be noise in the one place that has to stay readable.
 *
 * They do go through `mutate`, so grouping is undoable like anything else.
 *
 * @module hooks/useGroupActions
 */

import { useState } from "react";
import {
  createGroup,
  groupsOf,
  nextGroupId,
  removeFromGroups,
  removeGroup,
  toggleGroup,
  upsertGroup,
} from "../utils/groupUtils.js";

/**
 * @param {{ state: import('../types.js').REState, mutate: Function,
 *           setSelected: Function, setSelectedRel: Function }} deps
 */
export function useGroupActions({ state, mutate, setSelected, setSelectedRel }) {
  /**
   * What the group dialog is open on: an existing group, or `"new"` for one
   * being created. Null when the dialog is closed.
   *
   * @type {[import('../types.js').REGroup|"new"|null, Function]}
   */
  const [editingGroup, setEditingGroup] = useState(null);

  const withGroups = (fn) =>
    mutate((prev) => ({ ...prev, groups: fn(groupsOf(prev)) }));

  /**
   * Brackets a canvas selection together, or extends the group one of them is
   * already in. See {@link module:utils/groupUtils.createGroup} for which.
   *
   * @param {string[]} memberIds
   */
  const handleCreateGroup = (memberIds) => {
    if (new Set(memberIds).size < 2) return;
    withGroups((groups) => createGroup(groups, memberIds));
    // The nodes just grouped are about to be replaced or boxed; leaving one of
    // them selected would dim the rest of the graph around something the user
    // can no longer see.
    setSelected(null);
    setSelectedRel(null);
  };

  /**
   * Commits the group dialog: an exact name and an exact membership, which is
   * why this goes through `upsertGroup` rather than `createGroup`.
   *
   * @param {{ id: string|null, label: string, members: string[] }} group
   */
  const handleSaveGroup = (group) => {
    const id = group.id ?? nextGroupId(groupsOf(state));
    withGroups((groups) => upsertGroup(groups, group));
    setEditingGroup(null);
    setSelectedRel(null);
    // Hold on to the group just saved — its handles are drawn only for the
    // selection, and dropping it here took the chip away from under the hand
    // that had opened the dialog. A save that leaves too few members dissolves
    // the group instead, and then there is nothing to keep hold of.
    setSelected(new Set(group.members).size > 1 ? id : null);
  };

  /** @param {string} groupId */
  const handleUngroup = (groupId) => {
    withGroups((groups) => removeGroup(groups, groupId));
    setSelected((prev) => (prev === groupId ? null : prev));
  };

  /** @param {string} elementId */
  const handleRemoveFromGroup = (elementId) => {
    withGroups((groups) => removeFromGroups(groups, elementId));
  };

  /**
   * @param {string} groupId
   * @param {boolean} [collapsed] - Force a state rather than toggling.
   */
  const handleToggleGroup = (groupId, collapsed) => {
    const next = collapsed ?? !groupsOf(state).find((g) => g.id === groupId)?.collapsed;
    withGroups((groups) => toggleGroup(groups, groupId, collapsed));
    // Closing a group is putting it away, so it stops being what the user has
    // hold of: the handles are drawn for the selection, and leaving them up
    // over a tidied-away group is the clutter collapsing was asked to remove.
    // Opening one keeps it — `selectionIds` reads a selected group as covering
    // its members too, so the highlight follows it in, and the handle to close
    // it again stays where the hand already is.
    if (next) setSelected((prev) => (prev === groupId ? null : prev));
  };

  /**
   * Opens the group dialog. Pass a group id to change one, or nothing to make a
   * new one.
   *
   * @param {string} [groupId]
   */
  const handleEditGroupRequest = (groupId) => {
    setEditingGroup(
      groupId ? (groupsOf(state).find((g) => g.id === groupId) ?? null) : "new",
    );
  };

  return {
    groups: groupsOf(state),
    editingGroup,
    setEditingGroup,
    handleCreateGroup,
    handleSaveGroup,
    handleEditGroupRequest,
    handleUngroup,
    handleRemoveFromGroup,
    handleToggleGroup,
  };
}
