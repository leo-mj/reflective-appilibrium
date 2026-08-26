// @vitest-environment jsdom
//
// The tab-level add panels share an element pool with the graph modals: anything
// linkable is selectable, including withdrawn and rejected elements, but a form
// opens on something in play.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import {
  AddArgumentPanel,
  AddElementPanel,
  AddRelationPanel,
} from "./WorkflowAddPanels.jsx";
import { ADD_BAR_MIN_HEIGHT } from "./addPanelShared.js";
import {
  choose,
  labelsOf,
  openPicker,
  pickerValues,
  pickers,
  rowsOf,
} from "./dropdownTestUtils.js";
import { AddBar } from "./TextTabAddPanel.jsx";
import { C } from "../../constants/colors.js";
import { PALETTES } from "../../constants/palettes.js";

afterEach(cleanup);

const ELEMENTS = [
  { id: "J1", type: "judgment", status: "withdrawn", text: "a" },
  { id: "J2", type: "judgment", status: "active", text: "b" },
  { id: "P1", type: "principle", status: "active", text: "c" },
  { id: "P2", type: "principle", status: "rejected", text: "d" },
];

const button = (c, label) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === label);

describe("AddArgumentPanel", () => {
  it("offers every linkable element, flagging those out of play", () => {
    render(<AddArgumentPanel elements={ELEMENTS} onAddRelation={() => {}} />);
    // The flag is its own column at the right of the row, not a suffix on the
    // id — see STATUS_STYLE in Dropdown.
    expect(rowsOf(openPicker("Premise 1"))).toEqual([
      ["J1", "a", "withdrawn"],
      ["J2", "b"],
      ["P1", "c"],
      ["P2", "d", "rejected"],
    ]);
  });

  it("draws each element's statement beside its id", () => {
    render(<AddArgumentPanel elements={ELEMENTS} onAddRelation={() => {}} />);
    expect(rowsOf(openPicker("Premise 1"))).toContainEqual(["J2", "b"]);
  });

  it("opens on elements that are in play", () => {
    const { container } = render(
      <AddArgumentPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    // Premise then conclusion — J1 is withdrawn, so it is skipped for defaults.
    expect(pickerValues(container)).toEqual(["J2", "P1"]);
  });

  it("submits one relation per premise under a shared argumentId", () => {
    const onAddRelation = vi.fn();
    const { container } = render(
      <AddArgumentPanel elements={ELEMENTS} onAddRelation={onAddRelation} />,
    );
    fireEvent.click(button(container, "+ premise"));
    fireEvent.click(button(container, "Add argument"));

    expect(onAddRelation).toHaveBeenCalledTimes(2);
    const rels = onAddRelation.mock.calls.map(([r]) => r);
    expect(rels.every((r) => r.type === "jointly_entails")).toBe(true);
    expect(new Set(rels.map((r) => r.argumentId)).size).toBe(1);
    // Only J2 and P1 are in play, so the second premise has to come from the
    // wider pool rather than duplicating the first.
    expect(rels.map((r) => r.from)).toEqual(["J2", "J1"]);
  });

  it("switches the whole argument to precludes", () => {
    const onAddRelation = vi.fn();
    const { container } = render(
      <AddArgumentPanel elements={ELEMENTS} onAddRelation={onAddRelation} />,
    );
    fireEvent.click(button(container, "(jointly) entails →"));
    fireEvent.click(button(container, "Add argument"));

    expect(onAddRelation.mock.calls[0][0].type).toBe("precludes");
  });
});

describe("AddRelationPanel", () => {
  it("offers the argument types alongside the dialectical ones", () => {
    render(<AddRelationPanel elements={ELEMENTS} onAddRelation={() => {}} />);
    expect(labelsOf(openPicker("Relation type"))).toEqual([
      "supports",
      "conflicts",
      "undermines",
      "depends on",
      "entails",
      "precludes",
    ]);
  });

  it("opens on in-play endpoints but can still reach a withdrawn one", () => {
    const { container } = render(
      <AddRelationPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    expect(pickerValues(container)[0]).toBe("J2");
    expect(rowsOf(openPicker("Relation from"))).toContainEqual([
      "J1",
      "a",
      "withdrawn",
    ]);
  });

  it("submits the chosen endpoints and type", () => {
    const onAddRelation = vi.fn();
    const { container } = render(
      <AddRelationPanel elements={ELEMENTS} onAddRelation={onAddRelation} />,
    );
    choose("Relation from", "J1");
    choose("Relation type", "entails");
    fireEvent.click(button(container, "Add relation"));

    expect(onAddRelation).toHaveBeenCalledWith(
      expect.objectContaining({ from: "J1", type: "entails" }),
    );
  });
});

// A picker with no accessible name is announced as "combo box" and nothing
// else, which is axe's `critical` impact and the one defect class on these
// panels that assistive tech cannot work around. Asserted per panel rather than
// through the app-wide sweep because AddArgumentPanel renders a *variable*
// number of premise pickers, and a name shared between two of them reads as one
// control repeated — which a "has a name" check on a single instance misses.
describe("every control on the add panels is named", () => {
  const named = (el) =>
    (el.getAttribute("aria-label") ?? el.getAttribute("title") ?? "").trim();
  const unnamed = (container) =>
    [
      ...container.querySelectorAll(
        'input, textarea, [role="combobox"]',
      ),
    ]
      .filter((el) => !/[A-Za-z]{3,}/.test(named(el) || el.placeholder || ""))
      .map((el) => el.outerHTML.slice(0, 80));

  it("names both pickers on AddArgumentPanel, premises distinctly", () => {
    const { container } = render(
      <AddArgumentPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    expect(unnamed(container)).toEqual([]);
    fireEvent.click(button(container, "+ premise"));
    const names = pickers(container).map(named);
    expect(names).toEqual(["Premise 1", "Premise 2", "Conclusion"]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names all three pickers on AddRelationPanel", () => {
    const { container } = render(
      <AddRelationPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    expect(unnamed(container)).toEqual([]);
    expect(pickers(container).map(named)).toEqual([
      "Relation from",
      "Relation type",
      "Relation to",
    ]);
  });
});

// The panel's origin and confidence controls are the add bar's, caption and
// placement included: three unlabelled letters and two unlabelled boxes say
// nothing about what they set, and a reader who has met them under the text
// panel should not have to work them out again in an assist tab.
describe("the element panel's fields carry the bar's captions", () => {
  const renderPanel = () =>
    render(<AddElementPanel elementType="judgment" onAddElement={() => {}} />)
      .container;
  const caption = (container, text) =>
    [...container.querySelectorAll("span")].find(
      (s) => s.textContent === text && !s.querySelector("input"),
    );

  it("captions both groups", () => {
    const container = renderPanel();
    expect(caption(container, "By")).toBeTruthy();
    expect(caption(container, "Confidence")).toBeTruthy();
  });

  it("keeps each caption with its own control", () => {
    const container = renderPanel();
    const field = (text) => caption(container, text).parentElement;
    expect(field("By").querySelector("input").getAttribute("aria-label")).toBe(
      "Origin",
    );
    expect(
      [...field("Confidence").querySelectorAll("button")].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["L", "M", "H"]);
  });

  it("holds the pair against the far end, apart from the add button", () => {
    // What the element is filed under, rather than part of writing it — the
    // same reasoning, and the same margin, as the bar's own pair.
    const container = renderPanel();
    const pair = caption(container, "By").parentElement.parentElement;
    expect(pair.style.marginLeft).toBe("auto");
  });
});

// ─── One bar, one height ──────────────────────────────────────────────────────
// The panel at the foot of an assist tab and the strip under the text panel are
// the same control in two places, so they start at one height and are dragged
// together: a reader who has made the statement box taller has said how tall
// they want that box, not how tall they want it on this tab. jsdom lays nothing
// out, so what these hold is the wiring — the floor, the stored key, and which
// edges each of them offers.
describe("every add bar is one bar", () => {
  afterEach(() => localStorage.removeItem("addBarSize"));

  const PANELS = [
    ["element", AddElementPanel, "Add judgment"],
    ["relation", AddRelationPanel, "Add relation"],
    ["argument", AddArgumentPanel, "Add argument"],
  ];

  const renderPanel = (Panel) =>
    render(
      <Panel
        elementType="judgment"
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
      />,
    ).container.firstChild;

  const renderStrip = () =>
    render(
      <AddBar
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
        selected={null}
        ctrlTo={null}
      />,
    ).container.querySelector('[data-tutorial="add-bar"]');

  it.each(PANELS)("%s — starts at the strip's own floor", (_n, Panel) => {
    // Not merely equal to a number written here: equal to what the strip is
    // rendering, which is the pair that drifted to 14vh and 16vh.
    const panel = renderPanel(Panel);
    cleanup();
    expect(panel.style.minHeight).toBe(ADD_BAR_MIN_HEIGHT);
    expect(renderStrip().style.minHeight).toBe(ADD_BAR_MIN_HEIGHT);
  });

  it.each(PANELS)("%s — opens at the height the strip was left at", (_n, P) => {
    localStorage.setItem(
      "addBarSize",
      JSON.stringify({ height: 240, width: 500 }),
    );
    const panel = renderPanel(P);
    expect(panel.style.height).toBe("240px");
    // The width is not the panel's to take: it is as wide as the column the
    // central divider has left it.
    expect(panel.style.width).toBe("");
  });

  it.each(PANELS)("%s — offers the top edge and no other", (_n, Panel) => {
    renderPanel(Panel);
    expect(
      screen.getByRole("separator", { name: "Resize add bar height" }),
    ).toBeTruthy();
    expect(screen.queryAllByRole("separator")).toHaveLength(1);
  });

  it("writes what it was dragged to where every bar reads it", () => {
    localStorage.setItem(
      "addBarSize",
      JSON.stringify({ height: 240, width: 500 }),
    );
    renderPanel(AddElementPanel);
    fireEvent.keyDown(
      screen.getByRole("separator", { name: "Resize add bar height" }),
      { key: "ArrowUp" },
    );
    const stored = JSON.parse(localStorage.getItem("addBarSize"));
    expect(stored.height).toBeGreaterThan(0);
    // Untouched: an axis this bar does not offer is not one it may reset.
    expect(stored.width).toBe(500);

    cleanup();
    expect(renderStrip().style.height).toBe(`${stored.height}px`);
  });

  it("double-click drops the height without dropping the strip's width", () => {
    localStorage.setItem(
      "addBarSize",
      JSON.stringify({ height: 240, width: 500 }),
    );
    const panel = renderPanel(AddElementPanel);
    fireEvent.doubleClick(
      screen.getByRole("separator", { name: "Resize add bar height" }),
    );

    expect(panel.style.height).toBe("");
    expect(JSON.parse(localStorage.getItem("addBarSize"))).toEqual({
      height: null,
      width: 500,
    });
  });
});

// All three add buttons are the add bar's button: one fill, and the ink the
// viewing mode puts on a fill — white and bold in the default palette, the badge
// black and unweighted in high-contrast. Pinned per mode because a hex named
// here would be wrong in one of them, which is what these buttons were corrected
// for once already, in the other direction.
describe("the add buttons take the mode's ink", () => {
  afterEach(() => document.documentElement.removeAttribute("data-contrast"));

  // jsdom normalises an inline hex to rgb(), so the expectation is normalised
  // the same way rather than the assertion being loosened to a substring.
  const asRendered = (hex) => {
    const probe = document.createElement("span");
    probe.style.color = hex;
    return probe.style.color;
  };

  const PANELS = [
    ["judgment", AddElementPanel, "Add judgment"],
    ["relation", AddRelationPanel, "Add relation"],
    ["argument", AddArgumentPanel, "Add argument"],
  ];

  const addButton = (Panel, label) => {
    const { container } = render(
      <Panel
        elementType="judgment"
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
      />,
    );
    return button(container, label);
  };

  it.each(PANELS)("%s — the add bar's fill", (_name, Panel, label) => {
    expect(addButton(Panel, label).style.background).toBe(
      asRendered(C.supports),
    );
  });

  it.each(PANELS)("%s — white and bold by default", (_name, Panel, label) => {
    const el = addButton(Panel, label);
    expect(el.style.color).toBe(asRendered(PALETTES.default.ink));
    expect(el.style.fontWeight).toBe("bold");
  });

  it.each(PANELS)("%s — black, unweighted, in high-contrast", (_n, Panel, label) => {
    document.documentElement.setAttribute("data-contrast", "high");
    const el = addButton(Panel, label);
    expect(el.style.color).toBe(asRendered(PALETTES.accessible.ink));
    expect(el.style.fontWeight).toBe("normal");
  });

  // The default mode's white on that fill is 2.43:1, taken knowingly — the
  // marker is how the e2e audit tells this from a real failure, and without it
  // the assist audit fails the moment one of these buttons is enabled.
  it.each(PANELS)("%s — is marked as a graph accent", (_name, Panel, label) => {
    expect(addButton(Panel, label).dataset.accent).toBe("graph");
  });
});
