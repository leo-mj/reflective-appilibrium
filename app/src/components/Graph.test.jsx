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
    {
      id: "J1",
      type: "judgment",
      status: "active",
      confidence: 1,
      text: "J1.",
      addedRound: 1,
    },
    // Withdrawn in round 3, so withdrawn as of the current round.
    {
      id: "J2",
      type: "judgment",
      status: "withdrawn",
      confidence: 1,
      text: "J2.",
      addedRound: 1,
      withdrawnRound: 3,
    },
    {
      id: "P1",
      type: "principle",
      status: "active",
      confidence: 1,
      text: "P1.",
      addedRound: 1,
    },
    {
      id: "P2",
      type: "principle",
      status: "rejected",
      confidence: 1,
      text: "P2.",
      addedRound: 1,
    },
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

function Harness({
  state = STATE,
  positions = POSITIONS,
  onAddRelation = () => {},
  hideNonEntailsRels = false,
  onEditRequest = () => {},
  onWithdrawRequest = () => {},
  onReinstate = () => {},
  onCreateGroup = () => {},
  onToggleGroup = () => {},
  onUngroup = () => {},
  onEditGroupRequest = () => {},
}) {
  const [selected, setSelected] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);
  // Coupled exactly as `useREActions` couples them: picking a node clears any
  // relation selection and vice versa. Independent setters here hid a bug in
  // which letting go of a group re-selected it, because the second updater ran
  // against state the first had already blanked.
  const selectNode = (updater) => {
    setSelectedRel(null);
    setSelected(updater);
  };
  const selectRel = (updater) => {
    setSelected(null);
    setSelectedRel(updater);
  };
  return (
    <Graph
      state={state}
      hiddenLegendKeys={new Set()}
      positions={positions}
      selected={selected}
      onSelect={selectNode}
      selectedRel={selectedRel}
      onSelectRel={selectRel}
      onAddElement={() => {}}
      onAddRelation={onAddRelation}
      onEditRequest={onEditRequest}
      onWithdrawRequest={onWithdrawRequest}
      onReinstate={onReinstate}
      // Suppresses auto-fit, which would otherwise pan and zoom the view and
      // put the nodes somewhere other than their simulation coordinates.
      ready={false}
      recentlyAdded={null}
      hideNonEntailsRels={hideNonEntailsRels}
      onCreateGroup={onCreateGroup}
      onToggleGroup={onToggleGroup}
      onUngroup={onUngroup}
      onEditGroupRequest={onEditGroupRequest}
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

describe("half-written forms", () => {
  /** Opens a dialog from the graph's own toolbar. */
  const open = (container, label) =>
    fireEvent.click(container.querySelector(`[aria-label="${label}"]`));
  const statement = (container) => container.querySelector("textarea");

  it("keeps what was typed when the dialog is dismissed and reopened", () => {
    // A modal is easy to close by accident, and half-written text is worth
    // more than a clean slate.
    const { container } = setup();
    open(container, "Add judgment");
    fireEvent.change(statement(container), {
      target: { value: "Torturing is wrong." },
    });
    fireEvent.click(button(container, "Cancel"));
    expect(statement(container)).toBeNull();

    open(container, "Add judgment");
    expect(statement(container).value).toBe("Torturing is wrong.");
  });

  it("does not carry a submitted form into the next one", () => {
    // Committed work is not a draft.
    const { container } = setup();
    open(container, "Add judgment");
    fireEvent.change(statement(container), {
      target: { value: "Torturing is wrong." },
    });
    fireEvent.click(button(container, "Save"));

    open(container, "Add judgment");
    expect(statement(container).value).toBe("");
  });

  it("empties the form on Clear, without closing it", () => {
    const { container } = setup();
    open(container, "Add judgment");
    fireEvent.change(statement(container), {
      target: { value: "Torturing is wrong." },
    });

    fireEvent.click(button(container, "Clear"));
    expect(statement(container)).not.toBeNull();
    expect(statement(container).value).toBe("");
  });

  it("keeps a part-built argument across a dismissal", () => {
    const { container } = setup();
    open(container, "Add argument");
    fireEvent.click(button(container, "+ Add premise"));
    expect(modalSelects(container).length).toBe(3); // two premises, conclusion

    fireEvent.click(button(container, "Cancel"));
    open(container, "Add argument");
    expect(modalSelects(container).length).toBe(3);

    // …and Clear takes it back to one premise.
    fireEvent.click(button(container, "Clear"));
    expect(modalSelects(container).length).toBe(2);
  });

  it("lets a graph selection override the draft it reopens on", () => {
    // Ctrl-clicking two nodes is a fresh instruction, not a resumption.
    const { container, svg } = setup();
    open(container, "Add relation");
    fireEvent.change(modalSelects(container)[0], { target: { value: "P1" } });
    fireEvent.click(button(container, "Cancel"));

    // Picking the ends on the canvas, then confirming, reopens the dialog.
    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add relation"));

    expect(modalSelects(container)[0].value).toBe("J1");
  });
});

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
    const ids = new Set(
      onAddRelation.mock.calls.map(([rel]) => rel.argumentId),
    );
    expect(ids.size).toBe(1);
  });

  it("keeps a rejected suggestion as a premise too", () => {
    // A declined suggestion earns a second look by being argued for, so it has
    // to be reachable here.
    const { container, svg } = setup();

    clickNode(svg, "J1");
    clickNode(svg, "P2", { ctrl: true }); // rejected
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add argument"));

    expect(modalSelects(container).map((s) => s.value)).toEqual([
      "J1",
      "P2",
      "P1",
    ]);
  });

  it("labels the elements that are not currently in play", () => {
    const { container, svg } = setup();

    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add relation"));

    const [from] = modalSelects(container);
    expect([...from.options].map((o) => o.textContent)).toEqual([
      "J1",
      "J2 (withdrawn)",
      "P1",
      "P2 (rejected)",
    ]);
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

  // Grouping an argument relation under an argumentId is handleAddRelation's
  // job, and is covered in useREActions.test.js.
  it("submits the chosen argument type", () => {
    const onAddRelation = vi.fn();
    addRelationVia(onAddRelation, "entails");

    expect(onAddRelation).toHaveBeenCalledTimes(1);
    expect(onAddRelation.mock.calls[0][0]).toMatchObject({
      from: "J1",
      to: "P1",
      type: "entails",
    });
  });

  it("defaults to a dialectical type", () => {
    const onAddRelation = vi.fn();
    addRelationVia(onAddRelation);

    expect(onAddRelation.mock.calls[0][0]).toMatchObject({
      from: "J1",
      to: "P1",
      type: "supports",
    });
  });
});

describe("clicking a node pins its tooltip", () => {
  // The pinned card portals to document.body, so queries go through the body.
  const card = () =>
    [...document.body.querySelectorAll("div")].find(
      (d) => d.style.position === "fixed" && d.textContent.includes("Revise"),
    );

  /** Any fixed-position portal card, with or without actions. */
  const anyTooltip = () =>
    [...document.body.querySelectorAll("div")].find(
      (d) =>
        d.style.position === "fixed" && d.textContent.includes("Confidence"),
    );

  it("shows a tooltip on hover, but without actions", () => {
    const { svg } = setup();
    // `:scope >` matters: the pan/zoom wrapper also contains every node label,
    // so an unscoped text lookup matches it first.
    const nodeGroup = [...svg.querySelectorAll("g[transform]")].find(
      (g) => g.querySelector(":scope > text")?.textContent === "J1",
    );
    fireEvent.mouseOver(nodeGroup);

    // Non-vacuous: the tooltip is there, it just has nothing to act on.
    expect(anyTooltip()).toBeDefined();
    expect(card()).toBeUndefined();
  });

  it("pins the tooltip with the text tab's actions", () => {
    const { svg } = setup();
    clickNode(svg, "J1");

    const pinned = card();
    expect(pinned).toBeDefined();
    expect(pinned.textContent).toContain("J1");
    expect(
      [...pinned.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["Revise", "Withdraw"]);
  });

  it("offers reinstate instead for an element out of play", () => {
    const { svg } = setup();
    clickNode(svg, "J2"); // withdrawn
    expect(
      [...card().querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["Revise", "Reinstate"]);
  });

  it("closes when the same node is clicked again", () => {
    const { svg } = setup();
    clickNode(svg, "J1");
    expect(card()).toBeDefined();
    clickNode(svg, "J1");
    expect(card()).toBeUndefined();
  });

  it("closes when the background is clicked", () => {
    const { svg } = setup();
    clickNode(svg, "J1");
    fireEvent.pointerDown(svg, {
      clientX: 20,
      clientY: 400,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(svg, {
      clientX: 20,
      clientY: 400,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(card()).toBeUndefined();
  });

  it("does not pin on a ctrl+click, which is building an argument", () => {
    const { svg } = setup();
    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });
    expect(card()).toBeUndefined();
  });

  it("routes each action to its handler and closes", () => {
    const onWithdrawRequest = vi.fn();
    const { svg } = setup({ onWithdrawRequest });
    clickNode(svg, "J1");
    fireEvent.click(
      [...card().querySelectorAll("button")].find(
        (b) => b.textContent === "Withdraw",
      ),
    );
    expect(onWithdrawRequest).toHaveBeenCalledWith("J1");
    expect(card()).toBeUndefined();
  });
});

// Grouping is a view device: it changes what the canvas draws, never what the
// state says. These tests are about the first half of that — the second is
// utils/groupUtils.test.js.
describe("groups", () => {
  /** J1, J2 and P1, with P1 outside whatever gets grouped. */
  const GROUP_STATE = {
    ...STATE,
    elements: [
      { id: "J1", type: "judgment", status: "active", confidence: 1, text: "J1.", addedRound: 1 },
      { id: "J2", type: "judgment", status: "active", confidence: 1, text: "J2.", addedRound: 1 },
      { id: "P1", type: "principle", status: "active", confidence: 1, text: "P1.", addedRound: 1 },
    ],
    relations: [
      { from: "J1", to: "P1", type: "supports", explanation: "", addedRound: 1 },
      { from: "J2", to: "P1", type: "supports", explanation: "", addedRound: 1 },
      { from: "J1", to: "J2", type: "supports", explanation: "", addedRound: 1 },
    ],
  };
  const withGroup = (collapsed) => ({
    ...GROUP_STATE,
    groups: [
      { id: "G1", label: "Duties", members: ["J1", "J2"], collapsed },
    ],
  });

  /** A click at simulation coordinates, wherever they land. */
  const clickAt = (svg, x, y) => {
    const common = { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" };
    fireEvent.pointerDown(svg, common);
    fireEvent.pointerUp(svg, common);
  };

  /** Clicks the collapsed group's disc, at the centroid of J1 and J2. */
  const clickGroupNode = (container) =>
    clickAt(container.querySelector("svg"), 200, 100);

  /** Node ids the canvas is currently drawing, read off the label texts. */
  const drawnIds = (svg) =>
    [...svg.querySelectorAll("g[transform] > text")].map((t) => t.textContent);

  /** One per drawn edge — every relation type here has a filled arrowhead. */
  const arrowheads = (svg) => svg.querySelectorAll("polygon").length;

  it("offers Group for a ctrl+click selection, and reports both nodes", () => {
    const onCreateGroup = vi.fn();
    const { container, svg } = setup({
      state: GROUP_STATE,
      onCreateGroup,
    });

    clickNode(svg, "J1");
    clickNode(svg, "J2", { ctrl: true });
    fireEvent.click(button(container, "Group"));

    expect(onCreateGroup).toHaveBeenCalledWith(["J1", "J2"]);
  });

  it("leaves an expanded group's nodes and edges exactly as they were", () => {
    const bare = setup({ state: GROUP_STATE });
    const grouped = setup({ state: withGroup(false) });

    expect(drawnIds(grouped.svg)).toEqual(drawnIds(bare.svg));
    expect(arrowheads(grouped.svg)).toBe(arrowheads(bare.svg));
    // …but says where its boundary is.
    expect(grouped.svg.textContent).toContain("Duties");
  });

  it("draws a collapsed group as one node in place of its members", () => {
    const { svg } = setup({ state: withGroup(true) });
    const ids = drawnIds(svg);
    expect(ids).not.toContain("J1");
    expect(ids).not.toContain("J2");
    expect(ids).toContain("P1");
    // Count, unit and name — the disc says how much it is standing in for.
    expect(svg.textContent).toContain("Duties");
    expect(svg.textContent).toContain("2 elements");
  });

  it("keeps both crossing relations and drops the internal one", () => {
    // J1→P1 and J2→P1 both survive as G1→P1; J1→J2 goes with its endpoints.
    const { svg } = setup({ state: withGroup(true) });
    expect(arrowheads(svg)).toBe(2);
  });

  it("lists the members in the card hovering the group node shows", () => {
    const { svg } = setup({ state: withGroup(true) });
    // `:scope >` matters: the pan/zoom wrapper is a transformed <g> too, and
    // it contains every label on the canvas.
    const disc = [...svg.querySelectorAll("g[transform]")].find(
      (g) => g.querySelector(":scope > text")?.textContent === "Duties",
    );
    fireEvent.mouseOver(disc);

    const card = [...document.body.querySelectorAll("div")].find(
      (d) => d.style.position === "fixed" && d.textContent.includes("Duties"),
    );
    expect(card).toBeDefined();
    expect(card.textContent).toContain("J1");
    expect(card.textContent).toContain("J2");
    // A group is not a claim, so it is offered none of an element's actions.
    expect(card.textContent).not.toContain("Withdraw");
  });

  it("opens a collapsed group when it is clicked, and selects it", () => {
    // A group is a lid: the obvious thing to want from clicking one is to see
    // what is under it.
    const onToggleGroup = vi.fn();
    const { container } = setup({ state: withGroup(true), onToggleGroup });
    clickGroupNode(container);

    expect(onToggleGroup).toHaveBeenCalledWith("G1", false);
    // Selected as well, so its handles are on screen — the harness holds the
    // state flat, so the group is still collapsed here.
    expect(
      container.querySelector('[aria-label="Expand group Duties"]'),
    ).not.toBeNull();
  });

  it("keeps its handles off the canvas until the group is reached for", () => {
    // A chip over every group turns the canvas into a row of toolbars.
    const { container } = setup({ state: withGroup(true) });
    expect(container.querySelector('[aria-label^="Expand group"]')).toBeNull();
  });

  it("selects an expanded group from inside its box", () => {
    // Its members are ordinary nodes by then, so clicking one of those selects
    // the element; the box itself is the only handle the group has left.
    const { container, svg } = setup({ state: withGroup(false) });
    expect(container.querySelector('[aria-label^="Collapse group"]')).toBeNull();

    clickAt(svg, 200, 60); // inside the hull, clear of every node and edge
    expect(
      container.querySelector('[aria-label="Collapse group Duties"]'),
    ).not.toBeNull();
  });

  it("does not let a group be ctrl-picked into an argument", () => {
    const { container, svg } = setup({
      state: withGroup(true),
    });
    clickNode(svg, "P1", { ctrl: false });
    fireEvent.pointerDown(svg, { clientX: 200, clientY: 100, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(svg, {
      clientX: 200, clientY: 100, pointerId: 1, pointerType: "mouse", ctrlKey: true,
    });

    expect(button(container, "Add relation")).toBeUndefined();
    expect(button(container, "Add argument")).toBeUndefined();
  });

  it("puts the collapse, edit and ungroup handles on a chip", () => {
    const onToggleGroup = vi.fn();
    const onUngroup = vi.fn();
    const onEditGroupRequest = vi.fn();
    const { container, svg } = setup({
      state: withGroup(false),
      onToggleGroup,
      onUngroup,
      onEditGroupRequest,
    });
    clickAt(svg, 200, 60); // select the group by its box
    const chip = (label) => container.querySelector(`[aria-label="${label}"]`);

    fireEvent.click(chip("Collapse group Duties"));
    expect(onToggleGroup).toHaveBeenCalledWith("G1");

    fireEvent.click(chip("Edit group Duties"));
    expect(onEditGroupRequest).toHaveBeenCalledWith("G1");

    fireEvent.click(chip("Ungroup Duties"));
    expect(onUngroup).toHaveBeenCalledWith("G1");
  });

  it("puts its handles away when the group is closed from its own chip", () => {
    // Closing a group is tidying it away, and a toolbar left floating over the
    // result is the clutter that was being removed. `useGroupActions` drops the
    // selection on collapse; the harness below does what it does.
    const Live = () => {
      const [collapsed, setCollapsed] = useState(false);
      const [selected, setSelected] = useState(null);
      return (
        <Graph
          state={withGroup(collapsed)}
          hiddenLegendKeys={new Set()}
          positions={POSITIONS}
          selected={selected}
          onSelect={setSelected}
          selectedRel={null}
          onSelectRel={() => {}}
          onAddElement={() => {}}
          onAddRelation={() => {}}
          ready={false}
          recentlyAdded={null}
          hideNonEntailsRels={false}
          onToggleGroup={(id, next) => {
            const closing = next ?? !collapsed;
            setCollapsed(closing);
            if (closing) setSelected((prev) => (prev === id ? null : prev));
          }}
        />
      );
    };
    const { container } = render(<Live />);
    const svg = container.querySelector("svg");

    clickAt(svg, 200, 60); // select the expanded group by its box
    const collapse = container.querySelector(
      '[aria-label="Collapse group Duties"]',
    );
    expect(collapse).not.toBeNull();

    fireEvent.click(collapse);
    // The disc is drawn, and nothing is floating over it.
    expect(drawnIds(container.querySelector("svg"))).not.toContain("J1");
    expect(container.querySelector("[aria-label$='group Duties']")).toBeNull();
  });

  it("lets go of an expanded group when its box is clicked again", () => {
    // Clicking what is already selected drops it, the same as clicking a
    // selected node does.
    const { container, svg } = setup({ state: withGroup(false) });

    clickAt(svg, 200, 60);
    expect(
      container.querySelector('[aria-label="Collapse group Duties"]'),
    ).not.toBeNull();

    clickAt(svg, 200, 60);
    expect(
      container.querySelector('[aria-label="Collapse group Duties"]'),
    ).toBeNull();
  });

  it("keeps a group's handles on screen when it sits against an edge", () => {
    // The chip floats above the shape, so culling on the chip's own anchor
    // took the handles away from any group near the top of the panel — and an
    // expanded one there had no way left to close itself.
    const atTop = { J1: { x: 120, y: 10 }, J2: { x: 280, y: 10 }, P1: { x: 500, y: 260 } };
    const { container, svg } = setup({
      state: withGroup(false),
      positions: atTop,
    });

    clickAt(svg, 200, 45); // inside the hull, clear of both nodes and the edge
    expect(
      container.querySelector('[aria-label="Collapse group Duties"]'),
    ).not.toBeNull();
  });

  it("says grouping exists, without needing a modifier key found first", () => {
    // The ctrl+click path is quicker and the tooltip says so, but nobody
    // discovers a modifier key by looking at a canvas.
    const onEditGroupRequest = vi.fn();
    const { container } = setup({ state: GROUP_STATE, onEditGroupRequest });

    fireEvent.click(container.querySelector('[aria-label="New group"]'));
    expect(onEditGroupRequest).toHaveBeenCalledWith();
  });

  it("offers to expand once collapsed", () => {
    const { container } = setup({ state: withGroup(true) });
    clickGroupNode(container);
    expect(container.querySelector('[aria-label="Expand group Duties"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Collapse group Duties"]')).toBeNull();
  });
});
