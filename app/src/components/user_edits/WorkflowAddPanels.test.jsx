// @vitest-environment jsdom
//
// The tab-level add panels share an element pool with the graph modals: anything
// linkable is selectable, including withdrawn and rejected elements, but a form
// opens on something in play.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { AddArgumentPanel, AddRelationPanel } from "./WorkflowAddPanels.jsx";

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
