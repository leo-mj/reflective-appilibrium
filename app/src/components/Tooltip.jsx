/**
 * @fileoverview Generic hover tooltip with configurable delay.
 * Wraps a single child element — no extra DOM nodes, no layout impact.
 * @module components/Tooltip
 */

import { useState, useRef, useEffect, cloneElement, Children } from "react";
import { createPortal } from "react-dom";
import { C } from "../constants/colors.js";

/**
 * Shows a styled tooltip after `delay` ms of hovering over the child.
 * When `text` is falsy, the child is returned unchanged.
 *
 * @param {Object}          props
 * @param {string}          props.text       - Tooltip content.
 * @param {React.ReactNode} props.children   - Single child element to attach to.
 * @param {number}          [props.delay=400] - Hover delay in ms.
 */
export function Tooltip({ text, children, delay = 400 }) {
  const [pos, setPos] = useState(null);
  const timer = useRef(null);

  // A trigger can disappear mid-hover (a suggestion card being accepted, say),
  // which fires no mouseleave.
  useEffect(() => () => clearTimeout(timer.current), []);

  // The trigger node comes from the hover event rather than a ref, so nothing
  // has to be attached to the child. That keeps any ref the child already
  // carries intact, and avoids reading a ref during render. `currentTarget` is
  // cleared once the handler returns, so it is captured before the timer runs.
  function show(node) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!node.isConnected) return;
      const r = node.getBoundingClientRect();
      setPos({ top: r.bottom + 6, cx: Math.round(r.left + r.width / 2) });
    }, delay);
  }

  function hide() {
    clearTimeout(timer.current);
    setPos(null);
  }

  const child = Children.only(children);

  if (!text) return child;

  // react-hooks/refs flags any ref-touching function handed to a call during
  // render, and show/hide touch the timer ref. cloneElement does not invoke
  // them: React attaches them as DOM handlers and calls them on hover, which is
  // exactly where a ref is meant to be read.
  // eslint-disable-next-line react-hooks/refs
  const trigger = cloneElement(child, {
    onMouseEnter(e) { child.props.onMouseEnter?.(e); show(e.currentTarget); },
    onMouseLeave(e) { child.props.onMouseLeave?.(e); hide(); },
  });

  const cx = pos
    ? Math.max(110, Math.min(window.innerWidth - 110, pos.cx))
    : 0;

  return (
    <>
      {trigger}
      {pos && createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: cx,
            transform: "translateX(-50%)",
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "5px 9px",
            fontSize: 11,
            color: C.text,
            maxWidth: 220,
            pointerEvents: "none",
            zIndex: 1000,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            lineHeight: 1.45,
            textAlign: "center",
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
