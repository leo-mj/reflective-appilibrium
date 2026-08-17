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

/** Widest the box may get before its text wraps. Also sets how far from either
 * edge of the window it is allowed to sit, so it never overflows one. */
const MAX_W = 260;

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

  // Whether the trigger says what it is on screen. A label and an icon arrive
  // as an array, so a bare `typeof children === "string"` missed every row of
  // the ☰ menu and named them all after their tooltip instead — which is both
  // the wrong name and, once the tooltips were cut to a line, one that no
  // longer contained the word on the button.
  const hasVisibleText = Children.toArray(child.props.children).some(
    (c) => typeof c === "string" && c.trim(),
  );

  // react-hooks/refs flags any ref-touching function handed to a call during
  // render, and show/hide touch the timer ref. cloneElement does not invoke
  // them: React attaches them as DOM handlers and calls them on hover, which is
  // exactly where a ref is meant to be read.
  // eslint-disable-next-line react-hooks/refs
  const trigger = cloneElement(child, {
    // The icon-only buttons this wraps have no accessible name of their own, so
    // a screen reader announces a row of anonymous buttons. The tooltip text is
    // exactly the name they are missing. Naming them here rather than at each
    // call site means the next icon button is named by construction.
    //
    // Two triggers are left alone: one that already carries its own aria-label,
    // and one with visible text, where an aria-label would override what is on
    // screen with wording that may not match it.
    "aria-label":
      child.props["aria-label"] ?? (hasVisibleText ? undefined : text),
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

  // Half the widest the box may get, plus a margin, so a tooltip opened at the
  // edge of the window ends just short of it rather than flush against it.
  const half = MAX_W / 2 + 8;
  const cx = pos
    ? Math.max(half, Math.min(window.innerWidth - half, pos.cx))
    : 0;

  return (
    <>
      {trigger}
      {pos && createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            // Placed by transform from the left edge rather than by `left: cx`.
            // A fixed box with `left` set is laid out in what remains of the
            // window to its right, so a trigger near the right edge — the ☰
            // menu, every time — was squeezed to a column of one-word lines
            // however much room `maxWidth` gave it. From 0 the whole window is
            // available, and `max-content` keeps short text on one line.
            left: 0,
            transform: `translateX(${cx}px) translateX(-50%)`,
            width: "max-content",
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "5px 9px",
            fontSize: 11,
            color: C.text,
            maxWidth: MAX_W,
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
