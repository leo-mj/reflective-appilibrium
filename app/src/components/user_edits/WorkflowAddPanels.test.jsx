// @vitest-environment jsdom
//
// The tab-level add panels share an element pool with the graph modals: anything
// linkable is selectable, including withdrawn and rejected elements, but a form
// opens on something in play.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import {
  AddArgumentPanel,
  AddElementPanel,
  AddRelationPanel,
} from "./WorkflowAddPanels.jsx";
import { C } from "../../constants/colors.js";
import { PALETTES } from "../../constants/palettes.js";

afterEach(cleanup);

const ELEMENTS = [
  { id: "J1", type: "judgment", status: "withdrawn", text: "a" },
  { id: "J2", type: "judgment", status: "active", text: "b" },
  { id: "P1", type: "principle", status: "active", text: "c" },
  { id: "P2", type: "principle", status: "rejected", text: "d" },
];

const selects = (c) => [...c.querySelectorAll("select")];
const optionText = (select) => [...select.options].map((o) => o.textContent);
const button = (c, label) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === label);

describe("AddArgumentPanel", () => {
  it("offers every linkable element, flagging those out of play", () => {
    const { container } = render(
      <AddArgumentPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    expect(optionText(selects(container)[0])).toEqual([
      "J1 (withdrawn)",
      "J2",
      "P1",
      "P2 (rejected)",
    ]);
  });

  it("opens on elements that are in play", () => {
    const { container } = render(
      <AddArgumentPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    // Premise then conclusion — J1 is withdrawn, so it is skipped for defaults.
    expect(selects(container).map((s) => s.value)).toEqual(["J2", "P1"]);
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
    const { container } = render(
      <AddRelationPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    const type = selects(container)[1];
    expect([...type.options].map((o) => o.value)).toEqual([
      "supports",
      "conflicts",
      "undermines",
      "depends",
      "entails",
      "precludes",
    ]);
  });

  it("opens on in-play endpoints but can still reach a withdrawn one", () => {
    const { container } = render(
      <AddRelationPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    const [from] = selects(container);
    expect(from.value).toBe("J2");
    expect(optionText(from)).toContain("J1 (withdrawn)");
  });

  it("submits the chosen endpoints and type", () => {
    const onAddRelation = vi.fn();
    const { container } = render(
      <AddRelationPanel elements={ELEMENTS} onAddRelation={onAddRelation} />,
    );
    const [from, type] = selects(container);
    fireEvent.change(from, { target: { value: "J1" } });
    fireEvent.change(type, { target: { value: "entails" } });
    fireEvent.click(button(container, "Add relation"));

    expect(onAddRelation).toHaveBeenCalledWith(
      expect.objectContaining({ from: "J1", type: "entails" }),
    );
  });
});

// A <select> with no accessible name is announced as "combo box" and nothing
// else, which is axe's `critical` impact and the one defect class on these
// panels that assistive tech cannot work around. Asserted per panel rather than
// through the app-wide sweep because AddArgumentPanel renders a *variable*
// number of premise selects, and a name shared between two of them reads as one
// control repeated — which a "has a name" check on a single instance misses.
describe("every control on the add panels is named", () => {
  const named = (el) =>
    (el.getAttribute("aria-label") ?? el.getAttribute("title") ?? "").trim();
  const unnamed = (container) =>
    [...container.querySelectorAll("select, input, textarea")]
      .filter((el) => !/[A-Za-z]{3,}/.test(named(el) || el.placeholder || ""))
      .map((el) => el.outerHTML.slice(0, 80));

  it("names both selects on AddArgumentPanel, premises distinctly", () => {
    const { container } = render(
      <AddArgumentPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    expect(unnamed(container)).toEqual([]);
    fireEvent.click(button(container, "+ premise"));
    const names = selects(container).map(named);
    expect(names).toEqual(["Premise 1", "Premise 2", "Conclusion"]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names all three selects on AddRelationPanel", () => {
    const { container } = render(
      <AddRelationPanel elements={ELEMENTS} onAddRelation={() => {}} />,
    );
    expect(unnamed(container)).toEqual([]);
    expect(selects(container).map(named)).toEqual([
      "Relation from",
      "Relation type",
      "Relation to",
    ]);
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
