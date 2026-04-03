import { useState } from "react";
import { ModalShell } from "./ModalShell.jsx";
import { C } from "../../constants/colors.js";

/**
 * Modal that asks for an optional reason when withdrawing an element.
 *
 * @param {Object}   props
 * @param {string}   props.elementId          - ID of the element being withdrawn.
 * @param {function} props.onConfirm          - Called with the reason string (may be empty).
 * @param {function} props.onCancel           - Called when the user cancels.
 */
export function WithdrawReasonModal({ elementId, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");

  return (
    <ModalShell
      title={`Withdraw ${elementId}?`}
      subtitle="The element will be marked as withdrawn. You may optionally record a reason."
      onCancel={onCancel}
      onSave={() => onConfirm(reason)}
      saveLabel="Withdraw"
      saveDisabled={false}
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for withdrawal (optional)…"
        rows={3}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.text,
          fontSize: 12,
          padding: "8px 10px",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
    </ModalShell>
  );
}
