/**
 * @fileoverview What makes a box on screen a dialog to a keyboard.
 *
 * @module hooks/useDialog
 */

import { useEffect, useRef, useState } from "react";

/** What Tab can land on inside the dialog. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const activeElement = () =>
  typeof document === "undefined" ? null : document.activeElement;

/**
 * Takes the focus when the dialog opens — its first control, unless one has
 * focused itself — keeps Tab inside it, closes it on Escape, and hands the
 * focus back to whatever opened it. Spread `dialogProps` onto the dialog box;
 * the caller still names it (`aria-labelledby`).
 *
 * `open` is for a dialog that stays mounted while closed, as the header's
 * settings modals do; one that mounts only to show leaves it at `true`.
 *
 * The opener is read during render, before a field inside can take the focus
 * with `autoFocus` in the commit.
 *
 * **When the opener is gone, `returnFocusTo` takes the focus instead.** The
 * header's modals open from ☰ menu items, and the menu closes — unmounting the
 * item — in the same press that opens the dialog; restoring to a detached
 * element focused nothing, and the next Tab started from the top of the page.
 *
 * @param {Object}           args
 * @param {boolean}          [args.open]  Whether the dialog is showing.
 * @param {function(): void} args.onClose Called on Escape.
 * @param {{ current: HTMLElement|null }} [args.returnFocusTo] Where the focus
 *   goes on closing when the element that opened the dialog is no longer there.
 * @returns {{ dialogProps: Object }}
 */
export function useDialog({ open = true, onClose, returnFocusTo }) {
  const boxRef = useRef(null);
  const [shown, setShown] = useState(open);
  const [opener, setOpener] = useState(() => (open ? activeElement() : null));
  if (open !== shown) {
    setShown(open);
    setOpener(open ? activeElement() : null);
  }

  useEffect(() => {
    if (!open) return;
    const box = boxRef.current;
    if (box && !box.contains(document.activeElement))
      (box.querySelector(FOCUSABLE) ?? box).focus();
    // Taken as the dialog opens: the fallback — ☰ — is there throughout.
    const fallback = returnFocusTo?.current;
    return () => {
      // <body> is where the focus rests when nothing held it — a click in
      // Safari does not focus the button pressed — so it is no opener either.
      if (opener && opener !== document.body && document.contains(opener))
        opener.focus?.();
      else fallback?.focus?.();
    };
  }, [open, opener, returnFocusTo]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const stops = [...boxRef.current.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (!stops.length) return;
    const first = stops[0];
    const last = stops.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return {
    dialogProps: {
      ref: boxRef,
      role: "dialog",
      "aria-modal": "true",
      tabIndex: -1,
      onKeyDown,
    },
  };
}
