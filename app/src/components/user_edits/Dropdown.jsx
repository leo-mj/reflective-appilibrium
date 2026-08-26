/**
 * @fileoverview The picker the add bars and the add modals are built on: a
 * listbox of our own, in place of the browser's `<select>`.
 *
 * **Why not a `<select>`.** These pickers offer ids — `J1`, `P2` — and terms of
 * art. An id is all the control can fit and an id is what says nothing, so what
 * the reader needs is the statement behind it, at the moment they are choosing.
 * A native dropdown cannot show it: the open list is a window the operating
 * system draws, outside the page, where nothing we render can go. The only
 * thing that reaches inside one is the `title` attribute, and a native tooltip
 * hanging off a native list beside the app's own styled one is two answers to
 * one question, drawn by two different machines. This is the one way to put the
 * statement *in the row*, which is better than any tooltip: it is already there
 * when the eye arrives, and it needs no hover at all.
 *
 * So: `role="combobox"` on the trigger, `role="listbox"` on a portalled panel,
 * `role="option"` on the rows, `aria-activedescendant` for the keyboard. Focus
 * never leaves the trigger — the list is not a focus trap and does not need to
 * be, which is what keeps Escape, Tab and the arrow keys behaving the way they
 * do on the control this replaces.
 *
 * No tooltips anywhere on it, and that is the point: the row says what a
 * tooltip would have said, without a hover and without waiting. A tooltip on
 * the trigger as well only ever repeated the row the reader had just chosen.
 *
 * @module components/user_edits/Dropdown
 */

import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { C } from "../../constants/colors.js";

/**
 * @typedef {Object} DropdownOption
 * @property {string}  value
 * @property {string}  label   - What the trigger shows, and the row's first line.
 * @property {string}  [detail] - The statement or gloss, drawn beside the label
 *   in the row. Two lines at most; the text panel is where the whole of one is.
 * @property {string}  [status] - A note *about* the option rather than part of
 *   its name — "withdrawn", "rejected". Held out at the right; see STATUS_STYLE.
 * @property {string}  [group]  - Heading to draw above this row. A run of rows
 *   sharing one gets a single heading, as an `<optgroup>` would.
 */

/**
 * Widest the list may get, and twice the trigger's usual width: the rows carry
 * a statement, which at the trigger's width came out as a column of three-word
 * lines. Clamped to the window, so the phone is not asked for a panel wider
 * than its screen.
 */
export const LIST_MAX_W = 520;

/** Room the list keeps clear of either edge of the window. */
const MARGIN = 8;

/** How long a typed run of letters keeps matching before it starts over. */
const TYPEAHEAD_MS = 700;

/**
 * What "withdrawn" and "rejected" are drawn in, in the row and on the trigger
 * alike.
 *
 * Held out at the right rather than tacked onto the label, and set smaller: run
 * together as one string — `J2 (withdrawn)` — it pushed every statement in the
 * list out of line with its neighbours, and read as part of the element's name
 * rather than as a note about it.
 */
const STATUS_STYLE = {
  color: C.dim,
  fontSize: "0.8em",
  flexShrink: 0,
  marginLeft: "auto",
  textAlign: "right",
  fontStyle: "italic",
};

/**
 * What the row the picker is *holding* is washed with, under the accent bar and
 * the tick. Low enough to sit under the label without touching its contrast,
 * and distinct from the `C.border` the row under the pointer takes.
 */
const SELECTED_TINT = `${C.supports}24`;

/**
 * How the list is drawn against the trigger, given the room around it.
 *
 * Fixed rather than absolute, and portalled: the add bar and the modals both
 * clip their own overflow, and a list that opens downward out of a bar anchored
 * to the foot of the window has to be allowed out of it.
 *
 * @param {DOMRect} rect - The trigger's box.
 */
function place(rect) {
  // Never narrower than the trigger it belongs to — a list that does not cover
  // its own control reads as a different control — and never wider than the
  // window can hold.
  const width = Math.min(
    Math.max(rect.width, LIST_MAX_W),
    window.innerWidth - 2 * MARGIN,
  );
  // Held to the trigger's left edge, then pushed back inside the window — which
  // is what a picker at the right-hand end of the bar needs, the list being
  // twice its width.
  const left = Math.max(
    MARGIN,
    Math.min(rect.left, window.innerWidth - width - MARGIN),
  );
  const below = window.innerHeight - rect.bottom - MARGIN;
  const above = rect.top - MARGIN;
  // Downward unless there is meaningfully more room the other way. The bar sits
  // at the foot of the window, so upward is the common case there and downward
  // the common case in a modal; neither is the default.
  const flip = below < Math.min(220, above);
  return {
    width,
    left,
    top: flip ? undefined : rect.bottom + 4,
    bottom: flip ? window.innerHeight - rect.top + 4 : undefined,
    maxHeight: Math.max(120, (flip ? above : below) - 4),
  };
}

/**
 * A picker.
 *
 * @param {Object}   props
 * @param {string}   props.value
 * @param {function(string): void} props.onChange - Called with the value, not
 *   with an event: there is no `<select>` under this to read one off.
 * @param {DropdownOption[]} props.options
 * @param {string}   props.label   - The control's accessible name. Required —
 *   every one of these sits beside an unassociated caption or none at all, so
 *   this is the only name it has.
 * @param {Object}   props.style   - The trigger's box, from `selectStyle`.
 * @param {Object}   [props.layout] - Width and flex, for the wrapper.
 */
export function Dropdown({ value, onChange, options, label, style, layout }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const selectedIndex = options.findIndex((o) => o.value === value);
  /** The row the keyboard is on. Not the selection: that only moves on commit. */
  const [active, setActive] = useState(0);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ buffer: "", timer: null });
  const listId = useId();
  const rowId = (i) => `${listId}-${i}`;

  const selected = options[selectedIndex];

  /**
   * One width for every label in this list, taken from the longest of them, so
   * the statements beside them all start at the same place. In `ch` so it
   * tracks the reader's font, as the trigger's own width does.
   */
  const labelCol = `${Math.max(...options.map((o) => o.label.length), 2)}ch`;

  /**
   * The options as runs sharing a heading, which is the shape a listbox has to
   * be built in: it may own options and groups, and nothing else. An unnamed
   * run is the rows on their own — an element picker has no headings at all.
   */
  const sections = [];
  options.forEach((o, i) => {
    const last = sections[sections.length - 1];
    if (last && last.group === o.group) last.items.push({ o, i });
    else sections.push({ group: o.group, items: [{ o, i }] });
  });

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  // Measured after the browser has laid the trigger out but before it paints,
  // so the list never appears at last time's position for a frame.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () =>
      setPos(place(triggerRef.current.getBoundingClientRect()));
    measure();
    // Anything that moves the trigger under an open list — a scroll, a resize,
    // the tour's column being dragged — invalidates the placement. Re-measuring
    // is cheaper than closing, and closing on scroll surprises a reader who was
    // only nudging the wheel.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  // Keeps the row the keyboard is on in view, including the one the list opens
  // on — which for a long element list is somewhere in the middle of it.
  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector('[data-active="true"]');
    // Optional because jsdom has no layout and so no scrollIntoView; there is
    // nothing to scroll there either.
    row?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  // A click anywhere else puts the list away. `pointerdown` rather than click,
  // so it closes on the press rather than on the release — a press that starts
  // a drag elsewhere should not leave the list standing.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const openList = (at = selectedIndex) => {
    setActive(at < 0 ? 0 : at);
    setOpen(true);
  };

  const commit = (i) => {
    const option = options[i];
    if (option) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  /** Moves the keyboard `by` rows, stopping at either end rather than wrapping. */
  const move = (by) =>
    setActive((i) => Math.max(0, Math.min(options.length - 1, i + by)));

  /**
   * Typing letters jumps to the option starting with them — which on a list of
   * `J1 J2 … J11` is how anyone actually finds one, and is the one habit from
   * the native control worth keeping.
   */
  const typeahead = (key) => {
    clearTimeout(typed.current.timer);
    typed.current.buffer += key.toLowerCase();
    typed.current.timer = setTimeout(() => {
      typed.current.buffer = "";
    }, TYPEAHEAD_MS);
    const hit = options.findIndex((o) =>
      o.label.toLowerCase().startsWith(typed.current.buffer),
    );
    if (hit < 0) return;
    if (open) setActive(hit);
    else onChange(options[hit].value);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) commit(active);
      else openList();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      else move(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (open && (e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if (e.key === "Tab" && open) {
      setOpen(false);
      return;
    }
    // One printable character, and no modifier: ⌘/Ctrl combinations belong to
    // the app, and ctrl-Z inside a picker must still be undo.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      typeahead(e.key);
    }
  };

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-label={label}
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-haspopup="listbox"
      aria-activedescendant={open ? rowId(active) : undefined}
      // The value behind the label. A `<select>` carried one and everything
      // outside the control read it from there — tests, and Playwright's own
      // `selectOption`. A label is not a substitute, the status riding beside
      // it: what is drawn is "J2 withdrawn", and the value is still J2.
      data-value={value}
      onClick={() => (open ? setOpen(false) : openList())}
      onKeyDown={onKeyDown}
      style={{
        ...style,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        // A trigger is one line whatever it holds.
        whiteSpace: "nowrap",
        overflow: "hidden",
        // A button centres its content and a select does not; these two sit
        // side by side in the same row and must agree.
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        lineHeight: "normal",
        fontFamily: "inherit",
      }}
    >
      <span
        style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
      >
        {selected?.label ?? " "}
      </span>
      {/* Drawn as the list draws it: after the label, dim and smaller. Kept on
          the closed control because having chosen a withdrawn element is worth
          knowing once the list has shut again. */}
      {selected?.status && <span style={STATUS_STYLE}>{selected.status}</span>}
    </button>
  );

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        // The chevron reads `currentColor`, so the colour the trigger is drawn
        // in has to reach it — and it is the wrapper the arrow sits in.
        color: style.color,
        ...layout,
      }}
    >
      {trigger}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: `translateY(-50%) ${open ? "rotate(180deg)" : ""}`,
          fontSize: 10,
          lineHeight: 1,
          opacity: 0.6,
          pointerEvents: "none",
        }}
      >
        ▾
      </span>
      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
              maxHeight: pos.maxHeight,
              overflowY: "auto",
              background: C.panel,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: 4,
              // The size the closed control is set in. A list drawn at the
              // page's own font was a step up from the trigger that opened it,
              // which read as a different control rather than as its contents;
              // the detail and the status note are sized from it in `em`, so
              // the whole row follows whichever bar it belongs to.
              fontSize: style.fontSize,
              // Over the modal, which sits at 200.
              zIndex: 1000,
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            }}
          >
            {sections.map((section, s) => {
              const rows = section.items.map(({ o, i }) => (
                <div
                  key={o.value}
                  id={rowId(i)}
                  role="option"
                  aria-selected={i === selectedIndex}
                  data-active={i === active}
                  data-value={o.value}
                  // The press must not take focus off the trigger, which is
                  // what `aria-activedescendant` is announcing from.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(i)}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "5px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    // Two different things, and they have to stay legible at
                    // once: `active` is where the pointer or the keyboard is
                    // resting, `selected` is what the picker actually holds. On
                    // opening they are the same row, and the reader has to be
                    // able to see which of the others they have moved onto.
                    background:
                      i === active
                        ? C.border
                        : i === selectedIndex
                          ? SELECTED_TINT
                          : "transparent",
                    boxShadow:
                      i === selectedIndex
                        ? `inset 3px 0 0 ${C.supports}`
                        : undefined,
                  }}
                >
                  {/* A tick in a gutter every row reserves, so the labels stay
                      in one column whether or not one is ticked. Hidden from
                      the reading order: `aria-selected` on the row already says
                      this, and a screen reader would otherwise hear it twice. */}
                  <span
                    aria-hidden="true"
                    style={{
                      width: "1em",
                      flexShrink: 0,
                      color: C.supports,
                      fontWeight: "bold",
                    }}
                  >
                    {i === selectedIndex ? "\u2713" : ""}
                  </span>
                  <span
                    style={{
                      // The label wears the trigger's colour, which for the
                      // relation pickers is the relation's own.
                      color: style.color ?? C.text,
                      fontWeight: i === selectedIndex ? "bold" : "normal",
                      flexShrink: 0,
                      // One column for every row, so the statements beside them
                      // start on a line rather than stepping in and out with
                      // the length of each id.
                      width: labelCol,
                    }}
                  >
                    {o.label}
                  </span>
                  <span
                    style={{
                      color: C.dim,
                      // Relative, so it tracks the list's own size.
                      fontSize: "0.92em",
                      lineHeight: 1.35,
                      // Takes the middle whether it has anything in it or not,
                      // which is what holds the status against the right edge.
                      flex: 1,
                      minWidth: 0,
                      // Two lines, then an ellipsis. A statement long enough to
                      // need more is one the text panel is for.
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {o.detail}
                  </span>
                  {o.status && <span style={STATUS_STYLE}>{o.status}</span>}
                </div>
              ));
              // A named run becomes a `group`, which is what a listbox is
              // allowed to own besides options — and what an `<optgroup>`
              // already was. An unnamed one is the rows themselves.
              return !section.group ? (
                <Fragment key={s}>{rows}</Fragment>
              ) : (
                <div key={s} role="group" aria-label={section.group}>
                  <div
                    aria-hidden="true"
                    style={{
                      padding: "6px 8px 3px",
                      fontSize: 10,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      color: C.dim,
                    }}
                  >
                    {section.group}
                  </div>
                  {rows}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </span>
  );
}
