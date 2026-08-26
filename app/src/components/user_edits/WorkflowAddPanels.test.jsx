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
import { C, inkOn } from "../../constants/colors.js";

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

// app/CLAUDE.md: the nodes are the exception to AA, a button is not. These three
// named an ink by hand instead of asking, and white on the cyan is 2.43:1 — the
// worst contrast in the app. The fill is untouched; only the ink is asked for.
describe("the add buttons ask for their ink", () => {
  // jsdom normalises an inline hex to rgb(), so the expectation is normalised
  // the same way rather than the assertion being loosened to a substring.
  const asRendered = (hex) => {
    const probe = document.createElement("span");
    probe.style.color = hex;
    return probe.style.color;
  };

  it.each([
    ["judgment", AddElementPanel, "Add judgment", C.supports],
    ["relation", AddRelationPanel, "Add relation", C.supports],
    ["argument", AddArgumentPanel, "Add argument", C.jointly_entails],
  ])("%s", (_name, Panel, label, fill) => {
    const { container } = render(
      <Panel
        elementType="judgment"
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
      />,
    );
    const el = button(container, label);
    expect(el.style.color).toBe(asRendered(inkOn(fill)));
    expect(el.style.color).not.toBe(asRendered(C.onFill));
  });
});
