/**
 * @fileoverview Escape closes the ☰ menu and hands the focus back to ☰.
 * @module hooks/useMenuEscape
 */

import { useEffect } from "react";

/**
 * While `open`, Escape calls `onClose` and focuses `buttonRef`.
 *
 * On the document rather than on the menu: a menu opened with the mouse may
 * hold no focus at all — Safari does not focus a pressed button — so a handler
 * on the menu would never hear the key. In the capture phase, so it runs before
 * REState's own Escape, which lets go of the selection unless the event is
 * already handled; one press does one thing. Both headers use it, with
 * `enabled` off while the tour is walking the menu: there Escape closes the tour.
 *
 * @param {Object}            args
 * @param {boolean}           args.open
 * @param {function(): void}  args.onClose
 * @param {{ current: HTMLElement|null }} args.buttonRef  The ☰ button.
 * @param {boolean}           [args.enabled=true]
 */
export function useMenuEscape({ open, onClose, buttonRef, enabled = true }) {
  useEffect(() => {
    if (!open || !enabled) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, enabled, onClose, buttonRef]);
}
