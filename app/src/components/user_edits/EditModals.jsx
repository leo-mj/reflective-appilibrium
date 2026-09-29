/**
 * @fileoverview Overlay modals for editing elements/relations and confirming withdrawal.
 * @module components/user_edits/EditModals
 */

import { EditModal } from "./EditModal.jsx";
import { EditRelationModal } from "./EditRelationModal.jsx";
import { ReviseArgumentModal } from "./ReviseArgumentModal.jsx";
import { WithdrawReasonModal } from "./WithdrawReasonModal.jsx";
import { argumentRelationsOf } from "../../utils/stateUtils.js";

export function EditModals({
  editingEl,
  setEditingEl,
  onEditSave,
  editingRel,
  setEditingRel,
  onRelEditSave,
  onArgumentSave,
  relations,
  elements = [],
  argumentsOnly,
  round,
  withdrawingId,
  onWithdrawConfirm,
  onWithdrawCancel,
}) {
  // An argument has a dialog of its own, since its premises are what it is.
  const argument = editingRel && argumentRelationsOf(relations, editingRel);
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
      {editingRel && argument && (
        <ReviseArgumentModal
          argument={argument}
          elements={elements}
          currentRound={round}
          onSave={onArgumentSave}
          onCancel={() => setEditingRel(null)}
        />
      )}
      {editingRel && !argument && (
        <EditRelationModal
          relation={editingRel}
          argumentsOnly={argumentsOnly}
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
