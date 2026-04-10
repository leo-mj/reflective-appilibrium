/**
 * @fileoverview Overlay modals for editing elements/relations and confirming withdrawal.
 * @module components/user_edits/EditModals
 */

import { EditModal } from "./EditModal.jsx";
import { EditRelationModal } from "./EditRelationModal.jsx";
import { WithdrawReasonModal } from "./WithdrawReasonModal.jsx";

export function EditModals({
  editingEl,
  setEditingEl,
  onEditSave,
  editingRel,
  setEditingRel,
  onRelEditSave,
  round,
  withdrawingId,
  onWithdrawConfirm,
  onWithdrawCancel,
}) {
  return (
    <>
      {editingEl && (
        <EditModal
          element={editingEl}
          currentRound={round}
          onSave={onEditSave}
          onCancel={() => setEditingEl(null)}
        />
      )}
      {editingRel && (
        <EditRelationModal
          relation={editingRel}
          currentRound={round}
          onSave={onRelEditSave}
          onCancel={() => setEditingRel(null)}
        />
      )}
      {withdrawingId && (
        <WithdrawReasonModal
          elementId={withdrawingId}
          onConfirm={(reason) => onWithdrawConfirm(withdrawingId, reason)}
          onCancel={onWithdrawCancel}
        />
      )}
    </>
  );
}
