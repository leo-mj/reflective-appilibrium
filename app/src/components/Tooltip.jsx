/**
 * @fileoverview Generic tooltip: hover with a mouse, long press with a finger.
 * Wraps a single child element — no extra DOM nodes, no layout impact.
 * @module components/Tooltip
 */

import { useState, useRef, useEffect, cloneElement, Children } from "react";
import { createPortal } from "react-dom";
import { C } from "../constants/colors.js";

/** How long a finger rests on the trigger before the tooltip opens. */
const LONG_PRESS_MS = 500;

/**
 * A tap emits a mouseenter of its own a moment after the finger has already
 * left, for the sake of pages written before touch existed. A hover this soon
 * after a touch is that echo rather than a mouse, and must not open anything:
 * no mouseleave is coming either, so nothing would ever close it again.
 */
const MOUSE_ECHO_MS = 800;

/**
 * Shows a styled tooltip after `delay` ms of hovering over the child, or after
 * a long press on a touchscreen — where there is no hover to wait for, and the
 * icon buttons this wraps are otherwise unlabelled.
 *
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
  /** Set while a touch is in progress, or its trailing mouse events still could be. */
  const touching = useRef(false);
  /** Clears `touching` once those mouse events can no longer be coming. */
  const echoTimer = useRef(null);
  /** Set once a long press has opened the tooltip, cleared by the click it eats. */
  const longPressed = useRef(false);

  // A trigger can disappear mid-hover (a suggestion card being accepted, say),
  // which fires no mouseleave.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(echoTimer.current);
    },
    [],
  );

  // The trigger node comes from the hover event rather than a ref, so nothing
  // has to be attached to the child. That keeps any ref the child already
  // carries intact, and avoids reading a ref during render. `currentTarget` is
  // cleared once the handler returns, so it is captured before the timer runs.
  function show(node, ms, onShown) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!node.isConnected) return;
      const r = node.getBoundingClientRect();
      setPos({ top: r.bottom + 6, cx: Math.round(r.left + r.width / 2) });
      onShown?.();
    }, ms);
  }

  function hide() {
    clearTimeout(timer.current);
    setPos(null);
  }

  // A touch is over, for this purpose, not when the finger lifts but when the
  // mouse events it emits afterwards have stopped arriving. Timed rather than
  // clocked because react-hooks/purity will not have a component read the clock
  // — and a timer is what the rest of this component already runs on.
  function markTouched() {
    clearTimeout(echoTimer.current);
    touching.current = true;
    echoTimer.current = setTimeout(() => {
      touching.current = false;
    }, MOUSE_ECHO_MS);
  }

  const child = Children.only(children);

  if (!text) return child;

  // react-hooks/refs flags any ref-touching function handed to a call during
  // render, and show/hide touch the timer ref. cloneElement does not invoke
  // them: React attaches them as DOM handlers and calls them on hover, which is
  // exactly where a ref is meant to be read.
  // eslint-disable-next-line react-hooks/refs
  const trigger = cloneElement(child, {
    onMouseEnter(e) {
      child.props.onMouseEnter?.(e);
      if (touching.current) return;
      show(e.currentTarget, delay);
    },
    onMouseLeave(e) { child.props.onMouseLeave?.(e); hide(); },
    // Pointer events only handle touch here. A mouse is left to the hover
    // handlers above, where a click has never dismissed the tooltip and should
    // not start doing so.
    onPointerDown(e) {
      child.props.onPointerDown?.(e);
      if (e.pointerType !== "touch") return;
      markTouched();
      longPressed.current = false;
      show(e.currentTarget, LONG_PRESS_MS, () => {
        longPressed.current = true;
      });
    },
    onPointerUp(e) {
      child.props.onPointerUp?.(e);
      if (e.pointerType !== "touch") return;
      markTouched();
      hide();
    },
    // Fired when the browser claims the gesture — a press that turned into a
    // scroll. The finger never lifts, so this is the only end that arrives.
    onPointerCancel(e) {
      child.props.onPointerCancel?.(e);
      if (e.pointerType !== "touch") return;
      markTouched();
      hide();
    },
    onClick(e) {
      // A long press asked what the button does. Letting the click through as
      // well would answer by doing it.
      if (longPressed.current) {
        longPressed.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      child.props.onClick?.(e);
    },
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
