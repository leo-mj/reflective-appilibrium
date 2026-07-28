// @vitest-environment jsdom
//
// Ctrl+click builds a relation or an argument from nodes picked on the canvas.
// These tests drive the real pointer path, because the bugs they cover live in
// the hand-off between what the canvas lets you click and what the follow-up
// modal is willing to accept.
import { useState } from "react";
import { vi, describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { Graph } from "./Graph.jsx";

beforeAll(() => {
  // jsdom implements neither, and the graph needs both to mount and be clicked.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

afterEach(cleanup);

const STATE = {
  topic: "Test",
  phase: 2,
  round: 4,
  elements: [
    { id: "J1", type: "judgment", status: "active", confidence: 1, text: "J1.", addedRound: 1 },
    // Withdrawn in round 3, so withdrawn as of the current round.
    { id: "J2", type: "judgment", status: "withdrawn", confidence: 1, text: "J2.", addedRound: 1, withdrawnRound: 3 },
    { id: "P1", type: "principle", status: "active", confidence: 1, text: "P1.", addedRound: 1 },
    { id: "P2", type: "principle", status: "rejected", confidence: 1, text: "P2.", addedRound: 1 },
  ],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
};

const POSITIONS = {
  J1: { x: 100, y: 100 },
  J2: { x: 300, y: 100 },
  P1: { x: 500, y: 100 },
  P2: { x: 700, y: 100 },
};

function Harness({ onAddRelation = () => {}, hideNonEntailsRels = false }) {
  const [selected, setSelected] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);
  return (
    <Graph
      state={STATE}
      hiddenLegendKeys={new Set()}
      positions={POSITIONS}
      selected={selected}
      onSelect={setSelected}
      selectedRel={selectedRel}
      onSelectRel={setSelectedRel}
      onAddElement={() => {}}
      onAddRelation={onAddRelation}
      // Suppresses auto-fit, which would otherwise pan and zoom the view and
      // put the nodes somewhere other than their simulation coordinates.
      ready={false}
      recentlyAdded={null}
      hideNonEntailsRels={hideNonEntailsRels}
    />
  );
}

function setup(props) {
  const utils = render(<Harness {...props} />);
  return { ...utils, svg: utils.container.querySelector("svg") };
}

/** Clicks the canvas at a node's simulation coordinates. */
function clickNode(svg, id, { ctrl = false } = {}) {
  const { x, y } = POSITIONS[id];
  const common = { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" };
  // Down and up at the same point, so the gesture reads as a click, not a drag.
  fireEvent.pointerDown(svg, common);
  fireEvent.pointerUp(svg, { ...common, ctrlKey: ctrl });
}

/** Text of the button whose label matches, or undefined. */
function button(container, label) {
  return [...container.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
}

/** Every <select> in the open modal, in document order. */
function modalSelects(container) {
  return [...container.querySelectorAll("select")];
}

describe("ctrl+click argument building", () => {
  it("keeps a withdrawn node as a premise", () => {
    const { container, svg } = setup();

    clickNode(svg, "J1");
    clickNode(svg, "J2", { ctrl: true }); // withdrawn
    clickNode(svg, "P1", { ctrl: true });

    // Three nodes is an argument regardless of the relation view.
    const confirm = button(container, "Add argument");
    expect(confirm).toBeDefined();
    expect(container.textContent).toContain("J1, J2");

    fireEvent.click(confirm);

    // Premise selects come first, conclusion last.
    const selects = modalSelects(container);
    expect(selects.map((s) => s.value)).toEqual(["J1", "J2", "P1"]);
  });

  it("records the withdrawn premise in the saved relations", () => {
    const onAddRelation = vi.fn();
    const { container, svg } = setup({ onAddRelation });

    clickNode(svg, "J1");
    clickNode(svg, "J2", { ctrl: true });
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add argument"));
    // The modal's save button carries the same label as the accumulator's.
    fireEvent.click(button(container, "Add argument"));

    expect(onAddRelation).toHaveBeenCalledTimes(2);
    const froms = onAddRelation.mock.calls.map(([rel]) => rel.from);
    expect(froms).toEqual(["J1", "J2"]);
    for (const [rel] of onAddRelation.mock.calls) {
      expect(rel.to).toBe("P1");
      expect(rel.type).toBe("jointly_entails");
    }
    // One argument, so one shared id.
    const ids = new Set(onAddRelation.mock.calls.map(([rel]) => rel.argumentId));
    expect(ids.size).toBe(1);
  });

  it("ignores a ctrl+click on a rejected suggestion", () => {
    const { container, svg } = setup();

    clickNode(svg, "J1");
    clickNode(svg, "P2", { ctrl: true }); // rejected

    expect(button(container, "Add argument")).toBeUndefined();
    expect(button(container, "Add relation")).toBeUndefined();
  });
});

describe("ctrl+click relation building", () => {
  it("offers a relation for two nodes when all relations are visible", () => {
    const { container, svg } = setup({ hideNonEntailsRels: false });

    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });

    expect(button(container, "Add relation")).toBeDefined();
    expect(button(container, "Add argument")).toBeUndefined();
  });

  it("offers an argument instead when only arguments are shown", () => {
    const { container, svg } = setup({ hideNonEntailsRels: true });

    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });

    expect(button(container, "Add argument")).toBeDefined();
    expect(button(container, "Add relation")).toBeUndefined();
  });

  it("pre-fills the relation modal and offers the argument types", () => {
    const { container, svg } = setup();

    clickNode(svg, "J1");
    clickNode(svg, "J2", { ctrl: true }); // withdrawn
    fireEvent.click(button(container, "Add relation"));

    const [from, to, type] = modalSelects(container);
    expect(from.value).toBe("J1");
    expect(to.value).toBe("J2");
    expect([...type.options].map((o) => o.value)).toEqual([
      "supports",
      "conflicts",
      "undermines",
      "depends",
      "entails",
      "precludes",
    ]);
  });

  /** Ctrl+click J1 → P1, open the relation modal, optionally set a type, save. */
  function addRelationVia(onAddRelation, type) {
    const { container, svg } = setup({ onAddRelation });
    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add relation"));
    if (type) {
      fireEvent.change(modalSelects(container)[2], { target: { value: type } });
    }
    fireEvent.click(button(container, "Save"));
  }

  it("gives an argument type its own argumentId", () => {
    const onAddRelation = vi.fn();
    addRelationVia(onAddRelation, "entails");

    expect(onAddRelation).toHaveBeenCalledTimes(1);
    const [rel] = onAddRelation.mock.calls[0];
    expect(rel).toMatchObject({ from: "J1", to: "P1", type: "entails" });
    expect(rel.argumentId).toMatch(/^arg-/);
  });

  it("leaves a dialectical relation ungrouped", () => {
    const onAddRelation = vi.fn();
    addRelationVia(onAddRelation);

    expect(onAddRelation).toHaveBeenCalledTimes(1);
    const [rel] = onAddRelation.mock.calls[0];
    expect(rel).toMatchObject({ from: "J1", to: "P1", type: "supports" });
    expect(rel).not.toHaveProperty("argumentId");
  });
});
