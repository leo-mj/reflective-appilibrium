/**
 * @fileoverview What a merge would do, shown before it is done.
 *
 * How much it adds, and how much of the other process is already here —
 * identical elements are fused rather than doubled. The figures come from
 * `previewMerge`, which runs the merge itself, so what is described here is
 * what Merge then does.
 *
 * @module components/user_edits/MergeModal
 */

import { C } from "../../constants/colors.js";
import { ModalShell } from "./ModalShell.jsx";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const HEADING = { fontSize: 12, fontWeight: "bold", color: C.text, marginBottom: 6 };
const NOTE = { fontSize: 11, color: C.dim, marginBottom: 6, lineHeight: 1.5 };
const LIST = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 12,
  color: C.text,
  lineHeight: 1.5,
};

/**
 * @param {Object} props
 * @param {ReturnType<typeof import('../../utils/mergeStates.js').previewMerge>} props.preview
 * @param {function(): void} props.onConfirm
 * @param {function(): void} props.onCancel
 */
export function MergeModal({ preview, onConfirm, onCancel }) {
  const { label, added, relationsAdded, fused } = preview;

  return (
    <ModalShell
      title={`Merge “${label}”?`}
      subtitle={`Adds ${plural(added, "element")} and ${plural(relationsAdded, "relation")} in one round. Undo takes it back.`}
      onCancel={onCancel}
      onSave={onConfirm}
      saveLabel="Merge"
    >
      <div style={{ marginBottom: 18 }} data-testid="merge-identical">
        <div style={HEADING}>Identical elements: {fused.length}</div>
        {fused.length ? (
          <>
            <div style={NOTE}>
              Same type and wording as an element already here. Each is fused
              into the one here, which keeps its confidence and status.
            </div>
            <ul style={LIST}>
              {fused.map((f) => (
                <li key={f.from}>
                  <strong>{f.from}</strong> → <strong>{f.id}</strong>{" "}
                  <span style={{ color: C.dim }}>“{f.text}”</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div style={NOTE}>Nothing in it is already here.</div>
        )}
      </div>
    </ModalShell>
  );
}
