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
 * The height every add bar starts at, wherever it is drawn — the strip under
 * the text panel and the panel at the foot of an assist tab alike. One
 * constant, because they are one control in two places: the two were 16vh and
 * 14vh, which is close enough to look like a rendering fault rather than a
 * decision when a reader moves between the tabs.
 *
 * A floor rather than a size. The statement box takes whatever the controls
 * above it leave over, and anyone who wants more of it drags the top edge —
 * see {@link module:hooks/useAddBarSize}, which is where the dragged height
 * lives and which every bar reads from the same key.
 */
export const ADD_BAR_MIN_HEIGHT = "16vh";

export const PANEL_STYLE = {
  flexShrink: 0,
  borderTop: `1px solid ${C.border}`,
  background: C.panel,
  display: "flex",
  flexDirection: "column",
  padding: "8px 16px",
  minHeight: ADD_BAR_MIN_HEIGHT,
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
 * - `prominent` — the link tabs on a wide screen. There the pickers *are* the
 *   content: an argument is its premises and its conclusion, and the box under
 *   them holds an optional note. At the compact size they were dwarfed by it.
 * - `roomy` — the phone sheet, where everything is worked with a thumb.
 */
export const SIZES = {
  compact: { padding: "3px 6px", fontSize: 14 },
  prominent: { padding: "7px 12px", fontSize: 17, minHeight: 40 },
  roomy: { padding: "8px 12px", fontSize: 16, minHeight: 44 },
};

const GHOST_SIZES = {
  compact: { padding: "3px 7px", fontSize: 11 },
  prominent: { padding: "7px 12px", fontSize: 14, minHeight: 40 },
  roomy: { padding: "8px 12px", fontSize: 13, minHeight: 40 },
};

const ARROW_SIZES = { compact: 11, prominent: 15, roomy: 14 };

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
 * The shared box for an actual `<select>`, which needs two things the others
 * must not borrow: the chevron, and the room on the right to draw it in.
 *
 * @param {keyof SIZES} size
 */
export const selectStyle = (size) => ({
  ...fieldStyle(size),
  // WebKit renders a select at whatever height its own control wants and
  // ignores min-height and vertical padding on it, so a picker asked to match
  // the things beside it simply did not. Dropping the native appearance is what
  // gives the box back — at the cost of the arrow it drew, hence the one
  // painted on the right by Picker.
  appearance: "none",
  WebkitAppearance: "none",
  // Room on the right for the chevron Picker lays over it.
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
  fontSize: size === "compact" ? 12 : 14,
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
