import { C } from "../../constants/colors.js";
import { defaultPickerIds } from "../../utils/stateUtils.js";

export const SELECT_STYLE = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.text,
  padding: "3px 6px",
  fontSize: 14,
};

/**
 * What marks a control drawn in a graph constant, taken exactly.
 *
 * Every add button — the bar's, and the three in the assist tabs' own panels —
 * wears the supports teal with the palette's own ink on it, so in the default
 * mode they are under AA at 2.43:1. That is the bargain the node ramp already
 * strikes: judged by eye there, and high-contrast mode, where the ink turns
 * black and the pair clears AAA, is the compliant path. The e2e audit reads this
 * attribute to tell a deliberate default-mode failure from a real one, and only
 * ever in that mode; see `axeViolations`' `ignoreGraphAccents`.
 */
export const ACCENT_MARKER = { "data-accent": "graph" };

/**
 * The height the add bar starts at.
 *
 * A floor rather than a size. The statement box takes whatever the controls
 * above it leave over, and anyone who wants more of it drags the top edge —
 * see {@link module:hooks/useAddBarSize}, which is where the dragged height
 * lives. One strip under every tab now, so a height dragged while adding a
 * judgment is the height it still has on the arguments tab; it was two bars
 * reading one key to get that, back when the assist tabs had panels of their
 * own, and they had drifted to 16vh and 14vh — close enough to read as a
 * rendering fault rather than a decision when a reader moved between them.
 */
export const ADD_BAR_MIN_HEIGHT = "16vh";

/**
 * The floor under the bar's statement and explanation box.
 *
 * `flex: 1` alone hands the field whatever the controls above it have left
 * over, which once an argument's premises have wrapped the row twice is
 * nothing. The bar grows upward rather than squeezing it — see
 * {@link module:hooks/useAddBarSize} — and this is what it grows *by*: a floor
 * here is a floor on the whole bar's content height.
 */
export const TEXT_FIELD_MIN_HEIGHT = 44;

/**
 * The box the bar ends with — the statement on the element tab, the explanation
 * on the two link tabs, and the same field in the phone's sheet with the type
 * and the padding turned up. One object because it is one field: it was three
 * copies of it while the assist tabs had panels of their own, and each of the
 * rules below had to be found and then fixed three times over.
 */
export const EXPLANATION_STYLE = {
  flex: 1,
  minHeight: TEXT_FIELD_MIN_HEIGHT,
  marginTop: 8,
  resize: "none",
  // Stretched by the column it is in rather than sized at `width: 100%`. The
  // two agree to within half a pixel, and half a pixel is all it takes: a
  // percentage of a fractional content box rounds up, the field ends up wider
  // than the box holding it, and the bar — which has to be a scroll container
  // for the case where its controls outgrow it — puts a horizontal scrollbar
  // across the foot of the window for it. A stretched flex item is exact.
  alignSelf: "stretch",
  minWidth: 0,
  boxSizing: "border-box",
  // And the field's own scroll port, which is the last one here that could
  // paint a horizontal bar: a textarea wraps, so it has no legitimate use for
  // one, and its default `auto` will still show one for a fraction of a pixel —
  // which is what a viewport of an odd width (a scaled display) hands it, and
  // what WebKit rounds the wrong way. Down the page it still scrolls.
  overflowX: "hidden",
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.text,
  padding: "6px 10px",
  fontSize: 14,
  outline: "none",
};

// ─── Sizing ───────────────────────────────────────────────────────────────────

/**
 * The three sizes anything in the add bar is drawn at.
 *
 * `roomy` is the phone's version. There the bar is not a strip along the foot
 * of a working screen but a sheet with most of the screen to itself, and
 * everything in it is pressed with a thumb rather than clicked. It is a prop
 * rather than a media query because it follows the container, not the device:
 * the wide layout keeps its strip on a touchscreen, where there is still a
 * graph above it with a better claim on the height.
 *
 * - `compact` — the strip's default, for the element tab, where the statement
 *   below the controls is the thing being written and they are its trimmings.
 * - `prominent` — the link tabs on a wide screen. Set at 12px, below the
 *   element tab's own 14: an earlier version had these at 17 on the reasoning
 *   that the pickers *are* the content of a link tab, and at that size a row of
 *   them — two premises, a type and a conclusion — was a band of oversized
 *   controls across the foot of the window. What each one holds is now in the
 *   row of its open list rather than in the size of its trigger, so the trigger
 *   can go back to being small.
 * - `roomy` — the phone sheet, where everything is worked with a thumb.
 */
export const SIZES = {
  compact: { padding: "3px 6px", fontSize: 14 },
  prominent: { padding: "3px 8px", fontSize: 12, minHeight: 26 },
  roomy: { padding: "8px 12px", fontSize: 16, minHeight: 44 },
};

const GHOST_SIZES = {
  // The floor is WCAG 2.5.8's 24px, which the padding alone left it a couple of
  // pixels under — and these are the smallest controls in the app.
  compact: { padding: "3px 7px", fontSize: 11, minHeight: 24 },
  prominent: { padding: "3px 8px", fontSize: 12, minHeight: 26 },
  roomy: { padding: "8px 12px", fontSize: 13, minHeight: 40 },
};

const ARROW_SIZES = { compact: 11, prominent: 12, roomy: 14 };

export const ghostBtn = (size) => ({
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.dim,
  cursor: "pointer",
  ...GHOST_SIZES[size],
});

export const arrowStyle = (size) => ({
  color: C.dim,
  fontSize: ARROW_SIZES[size],
  fontWeight: "bold",
});

/**
 * The box every field in the bar sits in — pickers, text inputs and the letter
 * buttons alike.
 *
 * @param {keyof SIZES} size
 */
export const fieldStyle = (size) => ({ ...SELECT_STYLE, ...SIZES[size] });

/**
 * The shared box for a picker, which needs one thing the other fields must not
 * borrow: room on the right for the chevron
 * {@link module:components/user_edits/Dropdown} draws over it.
 *
 * `appearance: none` is left in although the control underneath is a button
 * now: a button carries its own platform styling on WebKit too, and the same
 * line is what takes it off.
 *
 * @param {keyof SIZES} size
 */
export const selectStyle = (size) => ({
  ...fieldStyle(size),
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: 28,
});

/**
 * Width enough for the longest thing a picker can hold, rather than for the one
 * it happens to hold now. A select sizes itself to its selected option, so
 * without this the picker changed width every time it was used — and the widest
 * options were left crowding the chevron.
 *
 * In `ch` so it tracks whichever of the reader's fonts is in use, plus a fixed
 * allowance for the padding and the chevron's reserved strip.
 *
 * @param {number} chars - Length of the longest option label.
 */
export const pickerWidth = (chars) => ({ minWidth: `calc(${chars}ch + 46px)` });

/**
 * Why the submit button is refusing. It is the only thing that says so, and a
 * disabled button explains nothing on its own, so it is announced as well as
 * shown — and set at a size someone is meant to read rather than notice.
 */
export const complaintStyle = (size) => ({
  // The phone's is the only one set larger: on a wide screen it has to sit in a
  // row of 12px controls without shouting over them.
  fontSize: size === "roomy" ? 14 : 12,
  color: C.conflicts,
});

/** The longest option an element picker holds, counting the status suffixes. */
export const idOptionChars = (elements) =>
  Math.max(
    4,
    ...elements.map(
      (e) =>
        e.id.length +
        (e.status === "withdrawn" ? 12 : e.status === "rejected" ? 11 : 0),
    ),
  );

// ─── Form defaults ────────────────────────────────────────────────────────────

/** @param {import('../../types.js').REElement[]} elements */
export function makeRelationDefaults(elements) {
  const ids = defaultPickerIds(elements);
  return {
    from: ids[0] ?? "",
    to: ids[1] ?? "",
    type: "supports",
    explanation: "",
  };
}

/**
 * An argument opens with one premise. More are added a row at a time, since
 * most arguments need two and no form can guess how many.
 *
 * @param {import('../../types.js').REElement[]} elements
 */
export function makeArgumentDefaults(elements) {
  const ids = defaultPickerIds(elements);
  return {
    premises: [ids[0] ?? ""],
    conclusion: ids[1] ?? "",
    negated: false,
    explanation: "",
  };
}
