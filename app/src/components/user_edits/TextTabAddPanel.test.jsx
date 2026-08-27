// @vitest-environment jsdom
//
// A graph selection pre-fills the link forms. That adjustment happens during
// render rather than in an effect, so these tests cover the cases where the two
// differ: a selection already present at mount, and a selection that is cleared
// and then re-made with the same id.
//
// The rest is what the bar offers: arguments in place of relations wherever the
// graph is showing arguments only, and arguments of more than one premise.
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";

import { C } from "../../constants/colors.js";
import { ARGUMENT_GLOSS, RELATION_GLOSS } from "../../constants/glosses.js";
import { PALETTES } from "../../constants/palettes.js";
import {
  choose,
  labelsOf,
  openPicker,
  picker,
  pickerValue,
  pickerValues,
  rowsOf,
  selectedRow,
} from "./dropdownTestUtils.js";
import { AddBar } from "./TextTabAddPanel.jsx";
import { ADD_BAR_MIN_HEIGHT } from "./addPanelShared.js";
import { HEIGHT_CAP } from "../../hooks/useAddBarSize.js";

/** How a dragged height reaches the bar: as a floor, under the same cap. */
const floorOf = (px) => `min(${px}px, ${HEIGHT_CAP})`;

afterEach(cleanup);

const ELEMENTS = [
  { id: "J1", type: "judgment", status: "active" },
  { id: "J2", type: "judgment", status: "active" },
  { id: "P1", type: "principle", status: "active" },
];

function renderBar(props = {}) {
  return render(
    <AddBar
      elements={ELEMENTS}
      onAddElement={() => {}}
      onAddRelation={() => {}}
      selected={null}
      ctrlTo={null}
      {...props}
    />,
  );
}

/** The tab on show, read off the textarea placeholder. */
function activeTab(container) {
  const placeholder = container.querySelector("textarea").placeholder;
  if (placeholder.startsWith("Enter statement")) return "element";
  return placeholder.startsWith("Why do these premises")
    ? "argument"
    : "relation";
}

/** The from/to picker values, in document order. */
function relationEndpoints(container) {
  const values = pickerValues(container);
  return { from: values[0], to: values[2] };
}

describe("AddBar graph-selection sync", () => {
  it("starts on the element tab with nothing selected", () => {
    const { container } = renderBar();
    expect(activeTab(container)).toBe("element");
  });

  it("switches to the relation tab and fills 'from' when a node is selected", () => {
    const { container, rerender } = renderBar();
    rerender(
      <AddBar
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
        selected="J2"
        ctrlTo={null}
      />,
    );
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container).from).toBe("J2");
  });

  it("picks up a selection that is already present on mount", () => {
    const { container } = renderBar({ selected: "P1" });
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container).from).toBe("P1");
  });

  it("fills 'to' from a ctrl-selected second node", () => {
    const { container } = renderBar({ selected: "J1", ctrlTo: "P1" });
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container)).toEqual({ from: "J1", to: "P1" });
  });

  it("re-applies the same id after the selection is cleared", () => {
    const props = {
      elements: ELEMENTS,
      onAddElement: () => {},
      onAddRelation: () => {},
      ctrlTo: null,
    };
    const { container, rerender } = renderBar({ selected: "J2" });
    expect(relationEndpoints(container).from).toBe("J2");

    // Back to the element tab by hand, selection cleared, then J2 again: the
    // panel must react even though the id has not changed since last time.
    rerender(<AddBar {...props} selected={null} />);
    rerender(<AddBar {...props} selected="J1" />);
    expect(relationEndpoints(container).from).toBe("J1");

    rerender(<AddBar {...props} selected={null} />);
    expect(activeTab(container)).toBe("relation");

    rerender(<AddBar {...props} selected="J1" />);
    expect(relationEndpoints(container).from).toBe("J1");
  });

  it("leaves the tab alone when the selection is cleared", () => {
    const props = {
      elements: ELEMENTS,
      onAddElement: () => {},
      onAddRelation: () => {},
      ctrlTo: null,
    };
    const { container, rerender } = renderBar({ selected: "J2" });
    rerender(<AddBar {...props} selected={null} />);
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container).from).toBe("J2");
  });
});

describe("what the bar offers", () => {
  it("offers relations only where the graph would show them", () => {
    renderBar({ hideNonEntailsRels: false });
    expect(screen.queryByText("Relation")).toBeTruthy();
    expect(screen.queryByText("Argument")).toBeTruthy();

    cleanup();
    // Arguments-only view: a supports or conflicts relation added here would
    // vanish the moment it was made.
    renderBar({ hideNonEntailsRels: true });
    expect(screen.queryByText("Relation")).toBeNull();
    expect(screen.queryByText("Argument")).toBeTruthy();
  });

  it("sends a graph selection to the argument tab when relations are hidden", () => {
    const { container } = renderBar({
      hideNonEntailsRels: true,
      selected: "J2",
      ctrlTo: "P1",
    });
    expect(activeTab(container)).toBe("argument");
    expect(pickerValue("Premise 1")).toBe("J2");
    expect(pickerValue("Conclusion")).toBe("P1");
  });

  it("keeps the reader on the argument tab when the setting flips under them", () => {
    const props = {
      elements: ELEMENTS,
      onAddElement: () => {},
      onAddRelation: () => {},
      selected: null,
      ctrlTo: null,
    };
    const { container, rerender } = renderBar({ hideNonEntailsRels: false });
    fireEvent.click(screen.getByText("Relation"));
    expect(activeTab(container)).toBe("relation");

    rerender(<AddBar {...props} hideNonEntailsRels />);
    expect(activeTab(container)).toBe("argument");
    // …and back again, rather than having been thrown off the tab for good.
    rerender(<AddBar {...props} hideNonEntailsRels={false} />);
    expect(activeTab(container)).toBe("relation");
  });
});

describe("the roomy layout", () => {
  /** Inline min-height in px, or 0 when the style leaves it to the content. */
  const minHeight = (el) => parseInt(el.style.minHeight, 10) || 0;

  it("gives the controls and the text field more room than the strip does", () => {
    // Compared rather than pinned to pixel values: what matters is that the
    // phone's copy is the larger of the two, not what either measures.
    const compact = renderBar().container;
    const compactTab = compact.querySelector("textarea");
    const compactBtn = screen.getByText("Element");
    const compactSize = {
      textarea: minHeight(compactTab),
      button: minHeight(compactBtn),
      fontSize: parseInt(compactBtn.style.fontSize, 10),
    };

    cleanup();
    const roomy = renderBar({ roomy: true }).container;
    const roomyTab = roomy.querySelector("textarea");
    const roomyBtn = screen.getByText("Element");

    expect(minHeight(roomyTab)).toBeGreaterThan(compactSize.textarea);
    expect(minHeight(roomyBtn)).toBeGreaterThan(compactSize.button);
    expect(parseInt(roomyBtn.style.fontSize, 10)).toBeGreaterThan(
      compactSize.fontSize,
    );
  });

  it("is off unless asked for, so the wide bar keeps its sizes", () => {
    renderBar();
    expect(minHeight(screen.getByText("Element"))).toBe(0);
    expect(minHeight(screen.getByText(/^Add$/))).toBe(0);
  });
});

describe("origin and confidence", () => {
  const originField = () => screen.queryByLabelText("Origin");
  const confidenceField = () => screen.queryByLabelText("Confidence, 0 to 1");
  const detailsToggle = () => screen.getByText(/^Details/);

  it("stays on show in the strip, which has the width for it", () => {
    renderBar();
    expect(originField()).toBeTruthy();
    expect(confidenceField()).toBeTruthy();
    expect(screen.queryByText(/^Details/)).toBeNull();
  });

  it("sits in the far corner of the strip, apart from the controls", () => {
    // What the element is filed under, rather than part of writing it.
    renderBar();
    expect(originField().parentElement.parentElement.style.marginLeft).toBe(
      "auto",
    );
  });

  it("stands the toggle level with the type picker, sharing the row", () => {
    renderBar({ roomy: true });
    const type = screen.getByLabelText("Element type");
    const details = detailsToggle();

    expect(details.style.minHeight).toBe(type.style.minHeight);
    // Laying out the picker is the wrapper's job now, the arrow being drawn
    // over it — so that is where its share of the row is set.
    expect(details.style.flex).toBe(type.parentElement.style.flex);
    // From their content widths, not from zero: a basis of 0 splits the row
    // evenly and cuts "Judgment" off partway through.
    expect(type.parentElement.style.flexBasis).toBe("auto");
  });

  it("draws the picker's own box, since WebKit will not size a native one", () => {
    renderBar({ roomy: true });
    const type = screen.getByLabelText("Element type");

    // With the native appearance left on, min-height and vertical padding are
    // ignored and the picker comes out shorter than everything beside it.
    expect(type.style.appearance).toBe("none");
    // Taking the box means taking the arrow it drew with it. Ours is laid over
    // the picker rather than painted behind it, so that it can read the
    // picker's colour instead of naming one of its own.
    const chevron = type.parentElement.querySelector('[aria-hidden="true"]');
    expect(chevron.textContent).toBe("▾");
    expect(chevron.style.pointerEvents).toBe("none");
  });

  it("keeps the picker's width when the details open below it", () => {
    // The group used to size to its contents, so revealing a wider row beneath
    // widened the picker along with it.
    renderBar({ roomy: true });
    const width = () => screen.getByLabelText("Element type").style.flexBasis;
    const before = width();

    fireEvent.click(detailsToggle());
    expect(width()).toBe(before);
    expect(
      screen.getByLabelText("Origin").parentElement.parentElement.style
        .flexBasis,
    ).toBe("100%");
  });

  it("gives the chevron to the pickers and to nothing else", () => {
    // Everything here shares one box style; only a select should get the arrow,
    // or an L looks like a dropdown and a number field loses the width its
    // value needs.
    renderBar({ roomy: true });
    fireEvent.click(detailsToggle());

    const chevronBy = (label) =>
      screen
        .getByLabelText(label)
        .parentElement.querySelector('[aria-hidden="true"]');
    expect(chevronBy("Element type")).toBeTruthy();
    for (const label of ["Low confidence", "Confidence, 0 to 1", "Origin"]) {
      expect(chevronBy(label)).toBeNull();
    }
  });

  it("colours the chevron with the picker it belongs to", () => {
    // The relation-type picker draws its text in the relation's colour; a
    // background image would have stayed grey beside it.
    renderBar();
    fireEvent.click(screen.getByText("Relation"));
    const picker = screen.getByLabelText("Relation type");

    expect(picker.parentElement.style.color).toBe(picker.style.color);
    expect(picker.style.color).not.toBe("");
  });

  it("is folded away on a phone until the toggle is pressed", () => {
    // Both carry a working default, so on a narrow screen they are detail —
    // the statement is what the reader opened the sheet to type.
    renderBar({ roomy: true });
    expect(originField()).toBeNull();
    expect(confidenceField()).toBeNull();
    expect(detailsToggle().getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(detailsToggle());
    expect(originField()).toBeTruthy();
    expect(confidenceField()).toBeTruthy();
    expect(detailsToggle().getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(detailsToggle());
    expect(originField()).toBeNull();
  });

  it("submits its defaults while folded away", () => {
    // Hiding them must not mean leaving them out.
    const onAddElement = vi.fn();
    renderBar({ roomy: true, onAddElement });
    fireEvent.change(screen.getByPlaceholderText(/Enter statement/), {
      target: { value: "Torturing is wrong." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add element" }));

    expect(onAddElement).toHaveBeenCalledTimes(1);
    expect(onAddElement.mock.calls[0][0]).toMatchObject({
      origin: "user",
      confidence: 0.67,
    });
  });

  it("keeps the details open across an add", () => {
    renderBar({ roomy: true, onAddElement: () => {} });
    fireEvent.click(detailsToggle());
    fireEvent.change(screen.getByPlaceholderText(/Enter statement/), {
      target: { value: "Torturing is wrong." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add element" }));

    expect(originField()).toBeTruthy();
  });
});

describe("where Clear sits", () => {
  const clearBtn = () => screen.getByRole("button", { name: /^Clear / });

  it("is put past the fields in the strip, away from Add", () => {
    // Beside Add it read as a second way to submit.
    renderBar();
    const add = screen.getByRole("button", { name: /^Add / });
    expect(clearBtn().parentElement).not.toBe(add.parentElement);
  });

  it("shares the tab row on a phone, at the far end of it", () => {
    // A row of its own for one button is a waste of a screen with none spare;
    // opposite ends of a row is distance enough.
    renderBar({ roomy: true });
    const add = screen.getByRole("button", { name: /^Add / });
    expect(clearBtn().parentElement).toBe(add.parentElement);
    expect(clearBtn().style.marginLeft).toBe("auto");
    // …and the tabs are pushed off that row rather than left to break wherever
    // their labels happen to measure.
    expect(screen.getByText("Element").parentElement.style.flexBasis).toBe(
      "100%",
    );
  });
});

describe("submitting from the keyboard", () => {
  const type = (text) =>
    fireEvent.change(screen.getByPlaceholderText(/Enter statement/), {
      target: { value: text },
    });

  it("takes cmd-enter as well as ctrl-enter", () => {
    // The app's own undo answers to both; on a Mac, cmd is the one reached for.
    for (const key of ["ctrlKey", "metaKey"]) {
      const onAddElement = vi.fn();
      renderBar({ onAddElement });
      type("Torturing is wrong.");
      fireEvent.keyDown(screen.getByPlaceholderText(/Enter statement/), {
        key: "Enter",
        [key]: true,
      });

      expect(onAddElement, key).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it("does nothing on a plain enter", () => {
    const onAddElement = vi.fn();
    renderBar({ onAddElement });
    type("Torturing is wrong.");
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter statement/), {
      key: "Enter",
    });

    expect(onAddElement).not.toHaveBeenCalled();
  });
});

describe("clearing a tab", () => {
  const clear = () => screen.getByText("Clear");

  it("puts an argument back to a single premise", () => {
    renderBar({ hideNonEntailsRels: true });
    fireEvent.click(screen.getByText("Argument"));
    fireEvent.click(screen.getByText("+ premise"));
    expect(screen.getByLabelText("Premise 2")).toBeTruthy();

    fireEvent.click(clear());
    expect(screen.queryByLabelText("Premise 2")).toBeNull();
    expect(screen.getByLabelText("Premise 1")).toBeTruthy();
  });

  it("empties the statement on the element tab", () => {
    renderBar();
    fireEvent.change(screen.getByPlaceholderText(/Enter statement/), {
      target: { value: "Torturing is wrong." },
    });

    fireEvent.click(clear());
    // Re-queried, not held: clearing replaces the field rather than emptying
    // it, so that the browser's undo stack goes with the text.
    expect(screen.getByPlaceholderText(/Enter statement/).value).toBe("");
  });

  it("leaves the field alone when an add empties it", () => {
    // A ctrl-enter submit happens from inside the field. Replacing it there
    // would take the focus with it, mid-flow.
    renderBar({ onAddElement: () => {} });
    const before = screen.getByPlaceholderText(/Enter statement/);
    fireEvent.change(before, { target: { value: "Torturing is wrong." } });
    fireEvent.click(screen.getByRole("button", { name: "Add element" }));

    expect(screen.getByPlaceholderText(/Enter statement/)).toBe(before);
    expect(before.value).toBe("");
  });

  it("replaces the field rather than emptying it", () => {
    renderBar();
    const before = screen.getByPlaceholderText(/Enter statement/);
    fireEvent.change(before, { target: { value: "Torturing is wrong." } });

    fireEvent.click(clear());
    expect(screen.getByPlaceholderText(/Enter statement/)).not.toBe(before);
  });

  it("adds nothing on its way", () => {
    const onAddElement = vi.fn();
    const onAddRelation = vi.fn();
    renderBar({ onAddElement, onAddRelation });
    fireEvent.change(screen.getByPlaceholderText(/Enter statement/), {
      target: { value: "Torturing is wrong." },
    });
    fireEvent.click(clear());

    expect(onAddElement).not.toHaveBeenCalled();
    expect(onAddRelation).not.toHaveBeenCalled();
  });

  it("names the tab it would clear", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Clear element" })).toBeTruthy();

    fireEvent.click(screen.getByText("Argument"));
    expect(screen.getByRole("button", { name: "Clear argument" })).toBeTruthy();
  });
});

describe("the buttons every tab shares", () => {
  const tabsGroup = () =>
    screen.getByRole("button", { name: /^Add / }).parentElement;

  it("does not drift down as the fields beside it grow taller", () => {
    // An argument taking on premises wraps its row onto a second line. Centred
    // against that, the submit button and the tabs moved down with it.
    renderBar();
    expect(tabsGroup().parentElement.style.alignItems).toBe("flex-start");
  });

  it("is not squeezed by a tab whose fields outgrow the row", () => {
    // Otherwise they would sit at a different width on every tab.
    renderBar();
    expect(tabsGroup().style.flexShrink).toBe("0");
  });

  it("still gives way on the phone, where it is the only way they fit", () => {
    // Held at full width there, the row runs off the side of the sheet instead
    // of breaking — see the group's own flexWrap.
    renderBar({ roomy: true });
    expect(tabsGroup().style.flexShrink).not.toBe("0");
  });
});

describe("how wide the pickers are", () => {
  it("holds each at the width of its longest option, not its chosen one", () => {
    // A select sizes itself to what it is showing, so without a floor the
    // picker changed width every time it was used.
    renderBar();
    // On the wrapper, which is what the row lays out now.
    const width = () =>
      screen.getByLabelText("Element type").parentElement.style.minWidth;
    expect(width()).toContain("ch");

    const before = width();
    fireEvent.change(screen.getByLabelText("Element type"), {
      target: { value: "theory" },
    });
    expect(width()).toBe(before);
  });

  it("counts the status suffix an element picker can carry", () => {
    // "J1 (withdrawn)" is a good deal longer than "J1".
    renderBar();
    fireEvent.click(screen.getByText("Relation"));
    const plain =
      screen.getByLabelText("Relation from").parentElement.style.minWidth;

    cleanup();
    render(
      <AddBar
        elements={[
          { id: "J1", type: "judgment", status: "active" },
          { id: "J2", type: "judgment", status: "withdrawn" },
        ]}
        onAddElement={() => {}}
        onAddRelation={() => {}}
        selected={null}
        ctrlTo={null}
      />,
    );
    fireEvent.click(screen.getByText("Relation"));
    const withStatus =
      screen.getByLabelText("Relation from").parentElement.style.minWidth;

    const chars = (w) => parseInt(w.match(/(\d+)ch/)[1], 10);
    expect(chars(withStatus)).toBeGreaterThan(chars(plain));
  });
});

describe("how big the pickers are", () => {
  // By role, not by label: an open list carries the picker's name too, so
  // `getByLabelText` matches two things once one has been opened.
  const fontOf = (label) => parseInt(picker(label).style.fontSize, 10);

  // An earlier version drew these at 17, on the reasoning that the pickers
  // *are* the content of a link tab. A row of them at that size — two premises,
  // a type and a conclusion — was a band of oversized controls across the foot
  // of the window, and what each one holds is now in the row of its open list
  // rather than in the size of its trigger.
  it("keeps the link tabs' pickers small in the strip", () => {
    renderBar();

    fireEvent.click(screen.getByText("Relation"));
    expect(fontOf("Relation from")).toBe(12);
    expect(fontOf("Relation type")).toBe(12);

    fireEvent.click(screen.getByText("Argument"));
    expect(fontOf("Premise 1")).toBe(12);
    expect(fontOf("Conclusion")).toBe(12);
  });

  it("draws them all alike on a phone, which has room for one size", () => {
    renderBar({ roomy: true });
    const element = fontOf("Element type");

    fireEvent.click(screen.getByText("Argument"));
    expect(fontOf("Premise 1")).toBe(element);
  });

  // Whichever bar it belongs to: a list set in the page's own font was a step
  // up from the trigger that opened it, and read as a different control rather
  // than as its contents.
  it("opens a link tab's list at the trigger's own size", () => {
    renderBar();
    fireEvent.click(screen.getByText("Argument"));
    expect(openPicker("Premise 1").style.fontSize).toBe("12px");
  });

  it("opens the element tab's list at its own, larger trigger's size", () => {
    renderBar();
    expect(openPicker("Element type").style.fontSize).toBe(
      `${fontOf("Element type")}px`,
    );
  });
});

describe("what says which thing is being added", () => {
  // The button reads "Add" at both widths, so the lit tab is the only thing on
  // screen naming its target. These cover the two ways that is carried.
  it("names the target in the button's accessible name, not its label", () => {
    renderBar();
    fireEvent.click(screen.getByText("Argument"));

    const add = screen.getByRole("button", { name: "Add argument" });
    // WCAG 2.5.3: the visible label has to be inside the accessible name, or
    // voice control cannot reach the button by what it says.
    expect(add.textContent).toBe("Add");
  });

  it("marks the lit tab in weight and border, not colour alone", () => {
    renderBar();
    const element = screen.getByText("Element");
    const argument = screen.getByText("Argument");

    expect(element.style.fontWeight).toBe("bold");
    expect(argument.style.fontWeight).toBe("normal");
    expect(element.style.border).not.toBe(argument.style.border);
    expect(element.getAttribute("aria-pressed")).toBe("true");
    expect(argument.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("adding an argument", () => {
  const addArgument = (onAddRelation, premiseIds) => {
    renderBar({ hideNonEntailsRels: true, onAddRelation });
    fireEvent.click(screen.getByText("Argument"));
    premiseIds
      .slice(1)
      .forEach(() => fireEvent.click(screen.getByText("+ premise")));
    premiseIds.forEach((id, i) => choose(`Premise ${i + 1}`, id));
    choose("Conclusion", "P1");
    // By role: the button reads "Add" and carries its target in the name.
    fireEvent.click(screen.getByRole("button", { name: "Add argument" }));
  };

  it("writes one relation per premise, grouped as a single argument", () => {
    // The shared argumentId is what makes the graph draw them converging on one
    // arrow, and what lets the argument be selected or deleted as a whole.
    const onAddRelation = vi.fn();
    addArgument(onAddRelation, ["J1", "J2"]);

    expect(onAddRelation).toHaveBeenCalledTimes(2);
    const [first, second] = onAddRelation.mock.calls.map(([rel]) => rel);
    expect(first.argumentId).toBe(second.argumentId);
    expect([first.from, second.from]).toEqual(["J1", "J2"]);
    expect([first.to, second.to]).toEqual(["P1", "P1"]);
    // Two premises make it a joint entailment; one would be a plain one.
    expect(first.type).toBe("jointly_entails");
  });

  it("stays a plain entailment with a single premise", () => {
    const onAddRelation = vi.fn();
    addArgument(onAddRelation, ["J1"]);
    expect(onAddRelation).toHaveBeenCalledTimes(1);
    expect(onAddRelation.mock.calls[0][0].type).toBe("entails");
  });

  it("will not add one whose conclusion is also a premise", () => {
    renderBar({ hideNonEntailsRels: true });
    fireEvent.click(screen.getByText("Argument"));
    choose("Premise 1", "P1");
    choose("Conclusion", "P1");
    expect(screen.getByRole("button", { name: "Add argument" }).disabled).toBe(
      true,
    );
    expect(screen.queryByText("Premise ≠ conclusion")).toBeTruthy();
  });
});

// ─── The filled buttons ───────────────────────────────────────────────────────
// Add and whichever tab is lit carry the same fill, and are written in the ink
// the viewing mode puts on a fill — white and bold in the default palette, the
// badge black and no weight in high-contrast. Pinned because naming an ink by
// hand is exactly what the assist tabs' own add panels had to be corrected for,
// and a hex written here would be wrong in one of the two modes.
describe("the add bar's filled buttons", () => {
  afterEach(() => document.documentElement.removeAttribute("data-contrast"));

  // jsdom normalises an inline hex to rgb(), so the expectation is normalised
  // the same way rather than the assertion being loosened to a substring.
  const asRendered = (hex) => {
    const probe = document.createElement("span");
    probe.style.color = hex;
    return probe.style.color;
  };

  /** The submit button and the lit tab, which is Element on an untouched bar. */
  const filled = () => [
    screen.getByRole("button", { name: "Add element" }),
    screen.getByRole("button", { name: "Element" }),
  ];

  it("share the add button's colour", () => {
    renderBar();
    for (const el of filled())
      expect(el.style.background).toBe(asRendered(C.supports));
  });

  it("are written in white, bold, in the default palette", () => {
    renderBar();
    for (const el of filled()) {
      expect(el.style.color).toBe(asRendered(PALETTES.default.ink));
      expect(el.style.fontWeight).toBe("bold");
    }
  });

  it("are written in the badge black, unweighted, in high-contrast", () => {
    document.documentElement.setAttribute("data-contrast", "high");
    renderBar();
    for (const el of filled()) {
      expect(el.style.color).toBe(asRendered(PALETTES.accessible.ink));
      expect(el.style.fontWeight).toBe("normal");
    }
  });

  it("leaves the tabs that are not lit unfilled", () => {
    renderBar();
    const el = screen.getByRole("button", { name: "Argument" });
    expect(el.style.background).toBe("transparent");
    expect(el.style.color).not.toBe(asRendered(C.supports));
  });
});

// ─── Resizing ─────────────────────────────────────────────────────────────────
// The strip is the reader's to size, and the size is remembered. jsdom lays
// nothing out, so what these hold is the wiring: which handles exist, that a key
// press writes an explicit size onto the bar and into storage, and that
// double-click takes it back off. The geometry itself is the browser's.
describe("AddBar resizing", () => {
  afterEach(() => localStorage.removeItem("addBarSize"));

  const bar = (container) => container.querySelector('[data-tutorial="add-bar"]');

  it("offers a handle per movable edge on the strip", () => {
    renderBar();
    expect(screen.getByRole("separator", { name: "Resize add bar height" })).toBeTruthy();
    expect(screen.getByRole("separator", { name: "Resize add bar width" })).toBeTruthy();
  });

  it("offers none on the phone sheet, which sizes itself", () => {
    renderBar({ roomy: true });
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });

  it("resizes from the keyboard and remembers what it was left at", () => {
    const { container } = renderBar();
    const handle = screen.getByRole("separator", { name: "Resize add bar height" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });

    // In px on the bar, where the dragged height is the floor it may not fall
    // below rather than the size it is held at.
    expect(bar(container).style.minHeight).toMatch(/^min\(\d+px, /);
    expect(JSON.parse(localStorage.getItem("addBarSize")).height).toBeGreaterThan(0);
  });

  it("ignores the arrow keys the edge cannot answer for", () => {
    const { container } = renderBar();
    fireEvent.keyDown(
      screen.getByRole("separator", { name: "Resize add bar height" }),
      { key: "ArrowRight" },
    );
    expect(bar(container).style.width).toBe("");
  });

  it("double-click puts both axes back to the stylesheet's own sizing", () => {
    const { container } = renderBar();
    const handle = screen.getByRole("separator", { name: "Resize add bar height" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.doubleClick(handle);

    expect(bar(container).style.minHeight).toBe(ADD_BAR_MIN_HEIGHT);
    expect(bar(container).style.width).toBe("");
    expect(JSON.parse(localStorage.getItem("addBarSize"))).toEqual({
      height: null,
      width: null,
    });
  });

  // The height the reader dragged to is how much room they want, not all the
  // bar may have: an argument taking on a third and fourth premise wraps the
  // controls row two and three deep, and a bar pinned to a height its contents
  // have outgrown clips them — which is how the text field came to be squeezed
  // out from under them. Past the dragged height the top edge moves up instead,
  // and past the cap the bar scrolls rather than reaching under the window.
  it("opens at the size the last drag left it, as a floor", () => {
    localStorage.setItem("addBarSize", JSON.stringify({ height: 240, width: 500 }));
    const { container } = renderBar();
    expect(bar(container).style.minHeight).toBe(floorOf(240));
    expect(bar(container).style.height).toBe("");
    expect(bar(container).style.width).toBe("500px");
  });

  // Being a scroll container is what makes a field half a pixel too wide a
  // horizontal scrollbar across the whole bar — and a percentage of a
  // fractional content box is exactly how that half pixel arrives.
  it("stretches the text field rather than sizing it at 100%", () => {
    const field = renderBar().container.querySelector("textarea");
    expect(field.style.width).toBe("");
    expect(field.style.alignSelf).toBe("stretch");
    // And no horizontal scroll port of its own: a textarea wraps, so `auto`
    // there can only ever be a rounding artefact.
    expect(field.style.overflowX).toBe("hidden");
  });

  it("is capped by the window and by the panel it sits in", () => {
    const { container } = renderBar();
    expect(bar(container).style.maxHeight).toBe(HEIGHT_CAP);
    expect(bar(container).style.overflowY).toBe("auto");
    expect(bar(container).style.overflowX).toBe("hidden");
  });

  it("keeps a floor under the text field for the bar to grow by", () => {
    const { container } = renderBar();
    expect(parseInt(container.querySelector("textarea").style.minHeight, 10))
      .toBeGreaterThan(0);
  });
});

// ─── What a picker says ───────────────────────────────────────────────────────
// Every picker in the bar offers terms of art and bare ids, neither of which
// says what it means. The statement rides in the row — which is the whole reason
// the list is ours to draw rather than the browser's — and no tooltip anywhere
// repeats it.
describe("AddBar picker glosses", () => {
  const WITH_TEXT = [
    { id: "J1", type: "judgment", status: "active", text: "Waste is wrong." },
    { id: "P1", type: "principle", status: "active", text: "Minimise harm." },
    {
      id: "J2",
      type: "judgment",
      status: "withdrawn",
      text: "Distance discounts.",
    },
  ];

  describe("in the open list, where the statement is drawn beside the id", () => {
    it("puts the statement in the row, not behind a hover", () => {
      renderBar({ elements: WITH_TEXT, selected: "J1" });
      expect(rowsOf(openPicker("Relation from"))).toEqual([
        ["J1", "Waste is wrong."],
        ["J2", "Distance discounts.", "withdrawn"],
        ["P1", "Minimise harm."],
      ]);
    });

    it("holds the status out at the right rather than onto the id", () => {
      // Run together as "J2 (withdrawn)" it pushed every statement in the list
      // out of line with its neighbours, and read as part of the name.
      renderBar({ elements: WITH_TEXT, selected: "J1" });
      const list = openPicker("Relation from");
      expect(labelsOf(list)).toEqual(["J1", "J2", "P1"]);
      const [, withdrawn] = within(list).getAllByRole("option");
      const note = withdrawn.lastElementChild;
      expect(note.textContent).toBe("withdrawn");
      // Right-hand side, and smaller than the statement beside it. Both sizes
      // are in `em`, so the whole row follows whichever bar it belongs to.
      expect(note.style.marginLeft).toBe("auto");
      expect(note.style.textAlign).toBe("right");
      expect(parseFloat(note.style.fontSize)).toBeLessThan(1);
      expect(note.style.fontSize.endsWith("em")).toBe(true);
    });

    it("carries the status onto the closed picker, drawn the same way", () => {
      renderBar({ elements: WITH_TEXT, selected: "J2" });
      const trigger = picker("Relation from");
      // The value stays the bare id; the note is a note.
      expect(trigger.dataset.value).toBe("J2");
      expect(trigger.lastElementChild.textContent).toBe("withdrawn");
    });

    it("glosses each relation type, and groups the two families", () => {
      renderBar({ elements: WITH_TEXT, selected: "J1" });
      const list = openPicker("Relation type");
      expect(rowsOf(list)).toContainEqual([
        "undermines",
        RELATION_GLOSS.undermines,
      ]);
      expect(
        [...list.querySelectorAll('[role="group"]')].map((g) =>
          g.getAttribute("aria-label"),
        ),
      ).toEqual(["Dialectical", "Argument"]);
    });

    // Judgment, Principle and Theory are words the reader has met on the tabs,
    // in the legend and on the nodes. A sentence apiece under a picker offering
    // three of them is noise where the words are doing the work.
    it("leaves the element types unglossed", () => {
      renderBar({ elements: WITH_TEXT });
      expect(rowsOf(openPicker("Element type"))).toEqual([
        ["Judgment", ""],
        ["Principle", ""],
        ["Theory", ""],
      ]);
    });

    it("glosses an argument in terms of its premises, not From and To", () => {
      renderBar({ elements: WITH_TEXT, hideNonEntailsRels: true });
      fireEvent.click(screen.getByText("Argument"));
      expect(rowsOf(openPicker("Argument type"))).toEqual([
        ["entails", ARGUMENT_GLOSS.entails],
        ["precludes", ARGUMENT_GLOSS.precludes],
      ]);
    });

    it("draws the label alone for an element with no statement", () => {
      // ELEMENTS carries ids and nothing else.
      renderBar({ selected: "J1" });
      expect(rowsOf(openPicker("Relation from"))).toEqual([
        ["J1", ""],
        ["J2", ""],
        ["P1", ""],
      ]);
    });

    // The rows say it already, and a tooltip over an open list — or repeating
    // the row the reader has just chosen — is the pile-up this replaced.
    it("offers no tooltip anywhere, open or closed", () => {
      renderBar({ elements: WITH_TEXT, selected: "J1" });
      for (const p of document.querySelectorAll('[role="combobox"]')) {
        fireEvent.mouseOver(p);
        expect(p.title).toBe("");
      }
      openPicker("Relation from");
      expect(
        [...document.body.querySelectorAll("div")].filter(
          (d) => d.style.position === "fixed" && !d.getAttribute("role"),
        ),
      ).toEqual([]);
    });
  });
});

// ─── The listbox itself ───────────────────────────────────────────────────────
// A control of our own has to answer for what the browser's did for free.
describe("AddBar picker behaviour", () => {
  const WITH_TEXT = [
    { id: "J1", type: "judgment", status: "active", text: "Waste is wrong." },
    { id: "P1", type: "principle", status: "active", text: "Minimise harm." },
    { id: "J2", type: "judgment", status: "active", text: "Distance counts." },
  ];

  it("opens and closes from the trigger", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const trigger = picker("Relation from");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // Two different things that have to be legible at once: `active` is where the
  // pointer or the keyboard is resting, `selected` is what the picker holds. On
  // opening they are the same row, and moving off it must not lose the second.
  it("marks the row it is holding with a tick and an accent, not weight alone", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const list = openPicker("Relation from");
    const row = selectedRow(list);
    expect(row.dataset.value).toBe("J1");
    expect(row.style.boxShadow).toContain("inset");
    // The tick sits in a gutter every row reserves, so the labels stay in one
    // column; it is hidden from the reading order, aria-selected saying it.
    const gutter = row.firstElementChild;
    expect(gutter.textContent).toBe("\u2713");
    expect(gutter.getAttribute("aria-hidden")).toBe("true");
    expect(
      [...list.querySelectorAll('[role="option"]')].map(
        (o) => o.firstElementChild.textContent,
      ),
    ).toEqual(["\u2713", "", ""]);
  });

  it("keeps the tick on the held row once the keyboard moves off it", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const trigger = picker("Relation from");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const list = screen.getByRole("listbox", { name: "Relation from" });
    const [held, moved] = [...list.querySelectorAll('[role="option"]')];
    expect(held.firstElementChild.textContent).toBe("\u2713");
    expect(moved.dataset.active).toBe("true");
    expect(moved.firstElementChild.textContent).toBe("");
  });

  it("marks the row the value is on, and moves the value on a click", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const list = openPicker("Relation from");
    const rows = [...list.querySelectorAll('[role="option"]')];
    expect(rows.map((r) => r.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    fireEvent.click(rows[2]);
    expect(pickerValue("Relation from")).toBe("P1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("walks the list with the arrow keys and commits on Enter", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const trigger = picker("Relation from");
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // opens, on J1
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // J2
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(pickerValue("Relation from")).toBe("J2");
  });

  it("closes on Escape without moving the value", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const trigger = picker("Relation from");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(pickerValue("Relation from")).toBe("J1");
  });

  it("jumps to a row by typing, the habit worth keeping from a select", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const trigger = picker("Relation from");
    // Closed, typing moves the value outright — as the native control did.
    fireEvent.keyDown(trigger, { key: "p" });
    expect(pickerValue("Relation from")).toBe("P1");
  });

  it("closes when something else is pressed", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    openPicker("Relation from");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("announces the row the keyboard is on, the focus never leaving", () => {
    renderBar({ elements: WITH_TEXT, selected: "J1" });
    const trigger = picker("Relation from");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const active = trigger.getAttribute("aria-activedescendant");
    expect(document.getElementById(active).textContent).toContain("J2");
  });
});
