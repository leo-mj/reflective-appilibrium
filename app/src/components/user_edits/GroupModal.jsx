/**
 * @fileoverview Dialog for creating a group and for changing one — its name and
 * its membership together, since those are the only two things a group is.
 * @module components/user_edits/GroupModal
 */

/** @import { REElement, REGroup } from '../../types.js' */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { sortElementIds } from "../../utils/stateUtils.js";
import { FormField, ModalShell } from "./ModalShell.jsx";

/** One selectable element, with a note when it is spoken for. */
function MemberRow({ el, checked, heldBy, onToggle }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "5px 4px",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 12,
        color: C.text,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`${el.id}: ${el.text}`}
        style={{ accentColor: C.supports, cursor: "pointer", marginTop: 2 }}
      />
      <span style={{ fontWeight: "bold", flexShrink: 0, width: "3em" }}>
        {el.id}
      </span>
      <span style={{ color: C.dim, minWidth: 0 }}>
        {el.text}
        {/* Ticking this moves the element rather than copying it — an element
            is in at most one group — so say which group is about to lose it. */}
        {heldBy && !checked && (
          <span style={{ color: C.undermines }}> · in {heldBy.label}</span>
        )}
      </span>
    </label>
  );
}

/**
 * @param {Object} props
 * @param {REGroup|null} props.group - The group being changed, or null to create one.
 * @param {REElement[]} props.elements - Everything that may be grouped.
 * @param {REGroup[]} props.groups - All groups, to say which already hold what.
 * @param {function({ id: string|null, label: string, members: string[] }): void} props.onSave
 * @param {function(): void} props.onCancel
 */
export function GroupModal({ group, elements, groups, onSave, onCancel }) {
  const [label, setLabel] = useState(group?.label ?? "");
  const [members, setMembers] = useState(() => new Set(group?.members ?? []));

  const toggle = (id) =>
    setMembers((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const sorted = [...elements].sort((a, b) => sortElementIds(a.id, b.id));
  const enough = members.size > 1;

  return (
    <ModalShell
      title={group ? `Edit ${group.label}` : "New group"}
      subtitle={
        group
          ? "Rename it, or change which elements it holds. Unticking everything but one dissolves the group."
          : "Pick the elements to bracket together. You can also ctrl/⌘-click them on the graph and choose Group there."
      }
      onCancel={onCancel}
      onSave={() =>
        onSave({
          id: group?.id ?? null,
          label,
          members: [...members].sort(sortElementIds),
        })
      }
      saveDisabled={!enough && !group}
      saveLabel={group ? "Save" : "Create group"}
    >
      <FormField label="Group name">
        <input
          type="text"
          value={label}
          autoFocus
          aria-label="Group name"
          placeholder="Group name"
          onChange={(e) => setLabel(e.target.value)}
          style={INPUT_STYLE}
        />
      </FormField>

      <FormField label={`Members (${members.size} selected)`}>
        <div
          style={{
            maxHeight: 260,
            overflowY: "auto",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "0 6px",
          }}
        >
          {sorted.map((el) => (
            <MemberRow
              key={el.id}
              el={el}
              checked={members.has(el.id)}
              heldBy={groups.find(
                (g) => g.id !== group?.id && g.members.includes(el.id),
              )}
              onToggle={() => toggle(el.id)}
            />
          ))}
        </div>
      </FormField>

      {!enough && (
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
          {group
            ? "Saving with fewer than two members dissolves this group."
            : "A group needs at least two elements."}
        </div>
      )}
    </ModalShell>
  );
}
