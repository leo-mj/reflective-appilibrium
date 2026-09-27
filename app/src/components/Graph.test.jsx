// @vitest-environment jsdom
//
// Ctrl+click builds a relation or an argument from nodes picked on the canvas.
// These tests drive the real pointer path, because the bugs they cover live in
// the hand-off between what the canvas lets you click and what the follow-up
// modal is willing to accept.
import { useState } from "react";
import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";

import { Graph } from "./Graph.jsx";
import { expandedCard, statementCard } from "../utils/statementCards.js";
import { elementRadius, fitView } from "../utils/graphHelpers.js";
import { setStatementViewOn } from "../utils/statementViewSetting.js";
import { C } from "../constants/colors.js";
import {
  choose,
  openPicker,
  pickerValues,
  pickers,
  rowsOf,
} from "./user_edits/dropdownTestUtils.js";

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
  search = "",
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
      search={search}
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

/** Every picker in the open modal, in document order. */
function modalSelects(container) {
  return pickers(container);
}

/** What those pickers are showing — an id each, the labels being ids. */
const modalValues = (container) => pickerValues(container);

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
    choose("From", "P1");
    fireEvent.click(button(container, "Cancel"));

    // Picking the ends on the canvas, then confirming, reopens the dialog.
    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add relation"));

    expect(modalValues(container)[0]).toBe("J1");
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
    expect(modalValues(container)).toEqual(["J1", "J2", "P1"]);
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

    expect(modalValues(container)).toEqual(["J1", "P2", "P1"]);
  });

  it("labels the elements that are not currently in play", () => {
    const { container, svg } = setup();

    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add relation"));

    // The note is a column of its own at the right of the row, not a suffix
    // on the id — see STATUS_STYLE in Dropdown.
    expect(
      rowsOf(openPicker("From")).map(([label, , status]) => [label, status]),
    ).toEqual([
      ["J1", undefined],
      ["J2", "withdrawn"],
      ["P1", undefined],
      ["P2", "rejected"],
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

    const [from, to] = modalValues(container);
    expect(from).toBe("J1");
    expect(to).toBe("J2");
    expect(
      rowsOf(openPicker("Relation type")).map(([label]) => label),
    ).toEqual([
      "Supports",
      "Conflicts",
      "Undermines",
      "Entails",
      "Precludes",
    ]);
  });

  /** Ctrl+click J1 → P1, open the relation modal, optionally set a type, save. */
  function addRelationVia(onAddRelation, type) {
    const { container, svg } = setup({ onAddRelation });
    clickNode(svg, "J1");
    clickNode(svg, "P1", { ctrl: true });
    fireEvent.click(button(container, "Add relation"));
    if (type) choose("Relation type", type);
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

  it("shows the statement for a node", () => {
    const { svg } = setup();
    clickNode(svg, "J1");
    expect(card().textContent).toContain("J1.");
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

describe("statement view", () => {
  // The switch is a module-level store, so it outlives a test's unmount.
  afterEach(() => setStatementViewOn(false));
  // These tests look at where things end up, so they ask for the jump the
  // reduced-motion setting gives; "gliding between views" drives the glide.
  const reduceMotion = (on) =>
    vi.stubGlobal("matchMedia", (query) => ({
      matches: on && query.includes("prefers-reduced-motion: reduce"),
    }));
  beforeEach(() => reduceMotion(true));
  afterEach(() => vi.unstubAllGlobals());

  const cards = (container) =>
    container.querySelectorAll('[data-testid="statement-card"]');
  /** The wording on each card, without the id on its badge. */
  const wordings = (container) =>
    [...cards(container)].map((c) => c.querySelector(":scope > text").textContent);
  const toggle = (container) =>
    container.querySelector('[aria-label="Show element text"]');

  it("draws each element as a card carrying its wording while switched on", () => {
    const { container } = setup();
    expect(cards(container)).toHaveLength(0);
    expect(toggle(container).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle(container));
    expect(toggle(container).getAttribute("aria-pressed")).toBe("true");
    expect(wordings(container).sort()).toEqual(["J1.", "J2.", "P1.", "P2."]);

    fireEvent.click(toggle(container));
    expect(cards(container)).toHaveLength(0);
  });

  it("carries the id the guided tour rings it by", () => {
    const { container } = setup();
    expect(toggle(container).getAttribute("data-tutorial")).toBe(
      "statement-toggle",
    );
  });

  it("is remembered across mounts", () => {
    const first = setup();
    fireEvent.click(toggle(first.container));
    first.unmount();

    const { container } = setup();
    expect(cards(container)).toHaveLength(4);
    expect(localStorage.getItem("graphStatements")).toBe("true");
  });

  it("spreads the nodes apart rather than moving the layout", () => {
    const { container } = setup();
    const nodeX = () =>
      [...container.querySelectorAll("g[transform^='translate(']")]
        .map((g) => g.getAttribute("transform"))
        .filter((t) => !t.includes("scale"));
    const before = nodeX();
    fireEvent.click(toggle(container));
    // Centroid of POSITIONS is x = 400: J1 at 100 lands at 400 - 300 × 1.5,
    // and no card is close enough to push it further.
    expect(nodeX()).toContain("translate(-50,100)");
    expect(nodeX()).not.toEqual(before);
  });

  it("draws the card backgrounds under the edges and the cards over them", () => {
    const state = {
      ...STATE,
      relations: [
        { from: "J1", to: "P1", type: "supports", explanation: "", addedRound: 1 },
      ],
    };
    const { container } = setup({ state });
    fireEvent.click(toggle(container));
    const drawn = [...container.querySelectorAll("svg g[transform] > *")];
    const edge = drawn.findIndex((n) => n.querySelector?.("path"));
    const firstCard = drawn.findIndex(
      (n) => n.querySelector?.('[data-testid="statement-card"]'),
    );
    // Backgrounds are the canvas's own rects, one per card, before the edge.
    const backgrounds = drawn.slice(0, edge).filter((n) => n.tagName === "rect");
    expect(edge).toBeGreaterThan(-1);
    expect(backgrounds).toHaveLength(4);
    expect(firstCard).toBeGreaterThan(edge);
  });

  it("puts the node inside the card, at its usual size, instead of beside it", () => {
    const { container, svg } = setup();
    // The canvas's own: the toggle's icon draws a circle too.
    const circles = () => [...svg.querySelectorAll("circle")];
    const j1Radius = () =>
      circles()
        .find((c) => c.parentElement.textContent.startsWith("J1"))
        .getAttribute("r");
    const before = j1Radius();
    const count = circles().length;

    fireEvent.click(toggle(container));
    // The same judgments, the same size, and no second shape each.
    expect(circles()).toHaveLength(count);
    expect(j1Radius()).toBe(before);
    for (const c of circles())
      expect(c.closest('[data-testid="statement-card"]')).not.toBeNull();
  });

  describe("hovering a card", () => {
    const LONG =
      "It is wrong to break a promise merely because keeping it has become inconvenient, even when nobody would ever find out that it had been broken.";
    const longState = {
      ...STATE,
      elements: STATE.elements.map((e) =>
        e.id === "J1" ? { ...e, text: LONG } : e,
      ),
    };

    /** The canvas's pan and zoom, off the transform it draws with. */
    const view = (svg) => {
      const [, px, py, z] = svg
        .querySelector(":scope > g")
        .getAttribute("transform")
        .match(/translate\(([^,]+),([^)]+)\) scale\(([^)]+)\)/);
      return { px: +px, py: +py, z: +z };
    };
    /** Clicks the canvas at a point in simulation coordinates. */
    const clickAt = (svg, x, y) => {
      const { px, py, z } = view(svg);
      const common = {
        clientX: x * z + px,
        clientY: y * z + py,
        pointerId: 1,
        pointerType: "mouse",
      };
      fireEvent.pointerDown(svg, common);
      fireEvent.pointerUp(svg, common);
    };
    /** Every card drawn for an element, grown or not. */
    const cardsOf = (container, id) =>
      [
        ...container.querySelectorAll(
          '[data-testid="statement-card"], [data-testid="statement-card-expanded"]',
        ),
      ].filter((c) => c.textContent.startsWith(id));
    /** The node group a card is drawn in: hover target, position, opacity. */
    const nodeOf = (container, id) =>
      cardsOf(container, id)[0].closest("g[transform^='translate(']");
    const at = (g) => {
      const [, x, y] = g
        .getAttribute("transform")
        .match(/translate\(([^,]+),([^)]+)\)/);
      return { x: +x, y: +y };
    };
    const grownOf = (container) =>
      container.querySelector('[data-testid="statement-card-expanded"]');

    it("grows the card itself to its whole statement, with no second card", () => {
      const { container } = setup({ state: longState });
      fireEvent.click(toggle(container));
      expect(grownOf(container)).toBeNull();

      fireEvent.mouseEnter(nodeOf(container, "J1"));
      expect(grownOf(container).textContent).toContain("had been broken.");
      expect(cardsOf(container, "J1")).toHaveLength(1);

      fireEvent.mouseLeave(nodeOf(container, "J1"));
      expect(grownOf(container)).toBeNull();
      expect(cardsOf(container, "J1")).toHaveLength(1);
    });

    it("answers the pointer anywhere on the card, not only on its border", () => {
      // jsdom does no hit-testing, so this pins the attribute that does it: an
      // outline with no fill is otherwise hit on its stroke alone.
      const { container } = setup({ state: longState });
      fireEvent.click(toggle(container));
      const outline = cardsOf(container, "J1")[0].querySelector(":scope > rect");
      expect(outline.getAttribute("fill")).toBe("none");
      expect(outline.getAttribute("pointer-events")).toBe("all");
    });

    it("answers the pointer with a heavier border, whether or not the card grows", () => {
      const { container } = setup({ state: longState });
      fireEvent.click(toggle(container));
      const border = (id) =>
        cardsOf(container, id)[0]
          .querySelector(":scope > rect")
          .getAttribute("stroke-width");
      expect(border("P1")).toBe("1.5");

      // P1's statement fits: nothing to grow, but it still answers.
      fireEvent.mouseEnter(nodeOf(container, "P1"));
      expect(grownOf(container)).toBeNull();
      expect(border("P1")).toBe("2.5");
      fireEvent.mouseLeave(nodeOf(container, "P1"));
      expect(border("P1")).toBe("1.5");

      // J1's does not: it grows, and is outlined the same way.
      fireEvent.mouseEnter(nodeOf(container, "J1"));
      expect(border("J1")).toBe("2.5");
    });

    it("pins details without the statement, which the card already shows", () => {
      const { container, svg } = setup({ state: longState });
      fireEvent.click(toggle(container));
      const { x, y } = at(nodeOf(container, "P1"));
      clickAt(svg, x, y);

      // The pinned box portals to document.body.
      const pinned = [...document.body.querySelectorAll("div")].find(
        (d) => d.style.position === "fixed" && d.textContent.includes("Revise"),
      );
      expect(pinned).toBeDefined();
      expect(pinned.textContent).toContain("P1");
      expect(pinned.textContent).toContain("Confidence");
      expect(pinned.textContent).not.toContain("P1.");
    });

    it("grows a tapped card, and ignores the mouse a browser emulates after a tap", () => {
      const { container, svg } = setup({ state: longState });
      fireEvent.click(toggle(container));
      const { x, y } = at(nodeOf(container, "J1"));
      const { px, py, z } = view(svg);
      const touch = { clientX: x * z + px, clientY: y * z + py, pointerId: 2, pointerType: "touch" };
      fireEvent.pointerDown(svg, touch);
      fireEvent.pointerUp(svg, touch);
      expect(grownOf(container)).not.toBeNull();

      // The emulated mouse leaving: not the reader's pointer.
      fireEvent.mouseLeave(nodeOf(container, "J1"));
      expect(grownOf(container)).not.toBeNull();

      // A tap on open canvas lets it go.
      const away = { ...touch, clientX: -500, clientY: -500 };
      fireEvent.pointerDown(svg, away);
      fireEvent.pointerUp(svg, away);
      expect(grownOf(container)).toBeNull();
    });

    it("leaves a card that already shows all of its statement as it is", () => {
      const { container } = setup();
      fireEvent.click(toggle(container));
      fireEvent.mouseEnter(nodeOf(container, "J1"));
      expect(grownOf(container)).toBeNull();
    });

    it("keeps a withdrawn or rejected card readable: badge faded, wording grey", () => {
      // STATE's J2 is withdrawn and its P2 rejected.
      const { container } = setup();
      fireEvent.click(toggle(container));
      const parts = (id) => {
        const card = cardsOf(container, id)[0];
        return {
          node: nodeOf(container, id).style.opacity,
          badge: card.querySelector(":scope > g").getAttribute("opacity"),
          outline: card.querySelector(":scope > rect").getAttribute("stroke-opacity"),
          wording: card.querySelector(":scope > text").getAttribute("fill"),
        };
      };
      expect(parts("J2")).toEqual({
        node: "1",
        badge: "0.25",
        outline: "0.25",
        wording: C.dim,
      });
      expect(parts("P2")).toMatchObject({ node: "1", badge: "0.35", wording: C.dim });
      expect(parts("J1")).toMatchObject({ badge: "1", wording: C.text });
    });

    it("still dims a whole card, withdrawn or not, for a selection elsewhere", () => {
      const { container, svg } = setup();
      fireEvent.click(toggle(container));
      const { x, y } = at(nodeOf(container, "J1"));
      clickAt(svg, x, y);
      expect(nodeOf(container, "J2").style.opacity).toBe("0.12");
      expect(nodeOf(container, "P1").style.opacity).toBe("0.12");
    });

    it("does not select anything", () => {
      const { container } = setup({ state: longState });
      fireEvent.click(toggle(container));
      fireEvent.mouseEnter(nodeOf(container, "J1"));
      expect(nodeOf(container, "P1").style.opacity).toBe("1");
    });

    it("takes a click on the grown part as a click on the card", () => {
      const { container, svg } = setup({ state: longState });
      fireEvent.click(toggle(container));
      const before = at(nodeOf(container, "J1"));
      fireEvent.mouseEnter(nodeOf(container, "J1"));

      // Below the card as it was, inside the card as it now is: a click on
      // open canvas before it grew, and a selection of J1 now — which dims P1.
      const el = longState.elements[0];
      const card = statementCard(el);
      const grown = expandedCard(el, card);
      expect(grown.dy).toBeGreaterThan(8);
      clickAt(svg, before.x, before.y + card.hh + grown.dy);
      expect(nodeOf(container, "P1").style.opacity).toBe("0.12");
    });
  });

  describe("gliding between views", () => {
    let frames;
    let now;
    beforeEach(() => {
      reduceMotion(false);
      frames = [];
      now = 0;
      vi.stubGlobal("requestAnimationFrame", (cb) => frames.push(cb));
      vi.stubGlobal("cancelAnimationFrame", () => {});
      vi.spyOn(performance, "now").mockImplementation(() => now);
    });
    afterEach(() => vi.restoreAllMocks());

    /** Runs the frames queued so far, at time `t`. */
    const frameAt = (t) => {
      now = t;
      const due = frames;
      frames = [];
      act(() => due.forEach((cb) => cb(t)));
    };
    /** J1's drawn x, off its node's transform. */
    const j1X = (container) => {
      const g = [...container.querySelectorAll("g[transform^='translate(']")].find(
        (n) => n.textContent.startsWith("J1") && !n.getAttribute("transform").includes("scale"),
      );
      return +g.getAttribute("transform").match(/translate\(([^,]+),/)[1];
    };

    it("moves each element from where it stood to where it is going", () => {
      const { container } = setup();
      fireEvent.click(toggle(container));
      // Cards at once, still where the nodes were.
      expect(cards(container)).toHaveLength(4);
      expect(j1X(container)).toBeCloseTo(100);

      frameAt(160);
      const midway = j1X(container);
      expect(midway).toBeLessThan(100);
      expect(midway).toBeGreaterThan(-50);

      frameAt(400);
      // At rest where the view puts it: 400 − 300 × 1.5.
      expect(j1X(container)).toBeCloseTo(-50);
      expect(frames).toHaveLength(0);
    });

    it("glides the view with them", () => {
      const { container, svg } = setup();
      const zoom = () =>
        +svg
          .querySelector(":scope > g")
          .getAttribute("transform")
          .match(/scale\(([^)]+)\)/)[1];
      const before = zoom();
      fireEvent.click(toggle(container));
      frameAt(400);
      const after = zoom();
      expect(after).not.toBeCloseTo(before);

      // And back, starting on the clock where the first glide left it.
      fireEvent.click(toggle(container));
      frameAt(560);
      const midway = zoom();
      expect((midway - after) * (before - after)).toBeGreaterThan(0);
      frameAt(800);
      expect(zoom()).toBeCloseTo(before);
    });

    it("never runs backwards on a frame stamped before the glide began", () => {
      const { container } = setup();
      now = 1000;
      fireEvent.click(toggle(container));
      frameAt(990);
      expect(j1X(container)).toBeCloseTo(100);
    });

    it("jumps for a reader who asks for less motion", () => {
      reduceMotion(true);
      const { container } = setup();
      fireEvent.click(toggle(container));
      expect(j1X(container)).toBeCloseTo(-50);
      expect(frames).toHaveLength(0);
    });
  });

  describe("zoomed far out", () => {
    const LONG =
      "It is wrong to break a promise merely because keeping it has become inconvenient, even when nobody would ever find out that it had been broken.";
    const longState = {
      ...STATE,
      elements: STATE.elements.map((e) =>
        e.id === "J1" ? { ...e, text: LONG } : e,
      ),
    };
    const zoomOf = (svg) =>
      +svg
        .querySelector(":scope > g")
        .getAttribute("transform")
        .match(/scale\(([^)]+)\)/)[1];
    /** Presses a zoom button until the zoom passes `limit`. */
    const zoomUntil = (container, svg, label, passed) => {
      const button = container.querySelector(`[aria-label="${label}"]`);
      for (let i = 0; i < 40 && !passed(zoomOf(svg)); i++) fireEvent.click(button);
    };
    const j1Card = (container) =>
      [...cards(container)].find((c) => c.textContent.startsWith("J1"));
    const j1Lines = (container) =>
      [...j1Card(container).querySelectorAll(":scope > text tspan")].map(
        (t) => t.textContent,
      );
    const j1Place = (container) =>
      j1Card(container)
        .closest("g[transform^='translate(']")
        .getAttribute("transform");

    it("shows one line per card, and every line again on the way back in", () => {
      const { container, svg } = setup({ state: longState });
      fireEvent.click(toggle(container));
      expect(j1Lines(container).length).toBeGreaterThan(1);
      const place = j1Place(container);

      zoomUntil(container, svg, "Zoom out", (z) => z < 0.3);
      const [line, ...rest] = j1Lines(container);
      expect(rest).toEqual([]);
      expect(line).toMatch(/^It is wrong.*…$/);
      // Drawn smaller, laid out the same: zooming moves nothing.
      expect(j1Place(container)).toBe(place);

      zoomUntil(container, svg, "Zoom in", (z) => z > 0.36);
      expect(j1Lines(container).length).toBeGreaterThan(1);
      expect(j1Place(container)).toBe(place);
    });

    it("keeps every line at the zoom a graph of a few dozen elements opens at", () => {
      // Around 45%, where the threshold first sat — and one line a card is what
      // the graph's opening view showed.
      const { container, svg } = setup({ state: longState });
      fireEvent.click(toggle(container));
      // First step under 45%: 41–45%, one 1.1× step being all it can overshoot.
      zoomUntil(container, svg, "Zoom out", (z) => z < 0.45);
      expect(zoomOf(svg)).toBeGreaterThan(0.4);
      expect(j1Lines(container).length).toBeGreaterThan(1);
    });

    it("does not flicker between the two near the threshold", () => {
      const { container, svg } = setup({ state: longState });
      fireEvent.click(toggle(container));
      zoomUntil(container, svg, "Zoom out", (z) => z < 0.3);
      // One step back in lands between the thresholds: still one line.
      fireEvent.click(container.querySelector('[aria-label="Zoom in"]'));
      expect(zoomOf(svg)).toBeLessThan(0.36);
      expect(j1Lines(container)).toHaveLength(1);
    });
  });
});

describe("an edge's explanation", () => {
  const withRelations = (relations) => ({ ...STATE, relations });
  const EXPLAINED = withRelations([
    {
      from: "J1",
      to: "P1",
      type: "supports",
      explanation: "Promises create expectations others rely on.",
      addedRound: 1,
    },
  ]);
  const label = (container) =>
    container.querySelector('[data-testid="relation-label"]');
  /** The box's lines, heading first — a line break is no space in textContent. */
  const lines = (container) =>
    [...label(container).querySelectorAll("tspan")].map((t) => t.textContent);
  // Without auto-fit the canvas is unpanned and unzoomed, so a point in
  // simulation coordinates is where it lands on screen. J1 and P1 sit at
  // x 100 and 500, so the edge between them passes through (200, 100) — clear
  // of J2, which stands on it at 300.
  const move = (svg, x, y, pointerType = "mouse") =>
    fireEvent.pointerMove(svg, { clientX: x, clientY: y, pointerId: 1, pointerType });

  it("shows the relation's type and explanation while the pointer is on it", () => {
    const { container, svg } = setup({ state: EXPLAINED });
    expect(label(container)).toBeNull();
    move(svg, 200, 100);
    const [heading, ...rest] = lines(container);
    expect(heading).toBe("Supports");
    expect(rest.join(" ")).toBe("Promises create expectations others rely on.");
    fireEvent.pointerLeave(svg, { pointerType: "mouse" });
    expect(label(container)).toBeNull();
  });

  it("shows nothing over a node, which answers for itself", () => {
    const { container, svg } = setup({ state: EXPLAINED });
    move(svg, 100, 100);
    expect(label(container)).toBeNull();
  });

  it("names the type alone when no explanation was given", () => {
    const { container, svg } = setup({
      state: withRelations([
        { from: "J1", to: "P1", type: "conflicts", explanation: "", addedRound: 1 },
      ]),
    });
    move(svg, 200, 100);
    expect(label(container).textContent).toBe("Conflicts");
  });

  it("shows on a tap, and goes on a tap elsewhere", () => {
    const { container, svg } = setup({ state: EXPLAINED });
    const tap = (x, y) => {
      const at = { clientX: x, clientY: y, pointerId: 2, pointerType: "touch" };
      fireEvent.pointerDown(svg, at);
      fireEvent.pointerUp(svg, at);
    };
    tap(200, 100);
    expect(label(container)).not.toBeNull();
    tap(300, 400);
    expect(label(container)).toBeNull();
  });

  it("gathers a joint argument's explanations", () => {
    const joint = (from, explanation) => ({
      from,
      to: "P1",
      type: "jointly_entails",
      argumentId: "A1",
      explanation,
      addedRound: 1,
    });
    const { container, svg } = setup({
      state: {
        ...STATE,
        positions: undefined,
        relations: [
          joint("J1", "Together they leave no exception."),
          joint("J2", "Together they leave no exception."),
        ],
      },
      positions: {
        J1: { x: 100, y: 100 },
        J2: { x: 100, y: 300 },
        P1: { x: 500, y: 200 },
        P2: { x: 700, y: 100 },
      },
    });
    // On the conclusion's arrow, past the junction.
    move(svg, 420, 200);
    const text = label(container).textContent;
    expect(text).toMatch(/^Jointly Entails/);
    // Said once, though both premises carry it.
    expect(text.match(/no exception/g)).toHaveLength(1);
  });
});

describe("the text panel's search, on the graph", () => {
  afterEach(() => setStatementViewOn(false));
  const RELATED = {
    ...STATE,
    relations: [
      { from: "J1", to: "P1", type: "supports", explanation: "", addedRound: 1 },
      { from: "P1", to: "P2", type: "conflicts", explanation: "", addedRound: 1 },
    ],
  };
  const nodeOpacity = (svg, id) =>
    [...svg.querySelectorAll("g[transform^='translate(']")]
      .find((g) => g.querySelector(":scope > text")?.textContent === id)
      .style.opacity;
  const edgeOpacities = (svg) =>
    [...svg.querySelectorAll("path[stroke-dasharray]")].map(
      (p) => p.parentElement.getAttribute("opacity"),
    );

  it("fades what it did not find, as a selection does", () => {
    const { svg } = setup({ state: RELATED, search: "j1" });
    expect(nodeOpacity(svg, "J1")).toBe("1");
    expect(nodeOpacity(svg, "P1")).toBe("0.12");
  });

  it("lights the edges the panel lists, and only those", () => {
    // "J1" is in the first relation's end, which the panel's test for a
    // relation reads, and not in the second's.
    const { svg } = setup({ state: RELATED, search: "J1" });
    const [toP1, p1ToP2] = edgeOpacities(svg).map(Number);
    expect(toP1).toBeCloseTo(0.7);
    expect(p1ToP2).toBeLessThan(0.1);
  });

  it("does not light an edge just for a found element at one end", () => {
    // Found in J1's statement: J1 is listed, the relation from it is not.
    const { svg } = setup({
      state: {
        ...RELATED,
        elements: RELATED.elements.map((e) =>
          e.id === "J1" ? { ...e, text: "Promises bind." } : e,
        ),
      },
      search: "promises",
    });
    expect(nodeOpacity(svg, "J1")).toBe("1");
    expect(Number(edgeOpacities(svg)[0])).toBeLessThan(0.1);
  });

  it("lights an edge whose explanation it finds, as the panel lists it", () => {
    const { svg } = setup({
      state: {
        ...RELATED,
        relations: [
          { ...RELATED.relations[0], explanation: "Trust is at stake." },
          RELATED.relations[1],
        ],
      },
      search: "trust",
    });
    const [explained, other] = edgeOpacities(svg).map(Number);
    expect(explained).toBeCloseTo(0.7);
    expect(other).toBeLessThan(0.1);
  });

  it("fades nothing without a query", () => {
    const { svg } = setup({ state: RELATED, search: "  " });
    expect(nodeOpacity(svg, "P1")).toBe("1");
  });

  it("marks what it found in a card's wording", () => {
    const { container } = setup({
      state: {
        ...STATE,
        elements: STATE.elements.map((e) =>
          e.id === "J1" ? { ...e, text: "Promises bind." } : e,
        ),
      },
      search: "BIND",
    });
    fireEvent.click(container.querySelector('[aria-label="Show element text"]'));
    const marks = [...container.querySelectorAll('[data-testid="search-mark"]')];
    expect(marks.map((m) => m.textContent)).toEqual(["bind"]);
  });
});


// ─── The view: following the selection, fit, double-click ────────────────────

describe("the view follows the selection", () => {
  // Where things land, not how they get there: the glide jumps under this.
  beforeEach(() =>
    vi.stubGlobal("matchMedia", (query) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
    })),
  );
  afterEach(() => {
    vi.unstubAllGlobals();
    setStatementViewOn(false);
  });

  const el = (id, type = "judgment") => ({
    id,
    type,
    status: "active",
    confidence: 1,
    text: `${id}.`,
    addedRound: 1,
  });
  // X1 is far off the right of a 700 × 400 canvas; E1 half off its left edge.
  const FAR = { J1: { x: 100, y: 100 }, X1: { x: 2000, y: 100 }, E1: { x: 10, y: 200 } };
  const REL = {
    from: "J1",
    to: "X1",
    type: "entails",
    explanation: "",
    addedRound: 1,
    argumentId: "a1",
  };
  const FAR_STATE = {
    ...STATE,
    elements: [el("J1"), el("X1"), el("E1")],
    relations: [REL],
  };

  /**
   * The graph with a way to select from outside the canvas, which is what the
   * text panel does.
   */
  function Follow({ onEditRequest = () => {} }) {
    const [selected, setSelected] = useState(null);
    const [selectedRel, setSelectedRel] = useState(null);
    const selectNode = (u) => {
      setSelectedRel(null);
      setSelected(u);
    };
    const selectRel = (u) => {
      setSelected(null);
      setSelectedRel(u);
    };
    return (
      <>
        <button onClick={() => selectNode(() => "X1")}>pick X1</button>
        <button onClick={() => selectNode(() => "E1")}>pick E1</button>
        <button onClick={() => selectRel(() => REL)}>pick relation</button>
        <Graph
          state={FAR_STATE}
          hiddenLegendKeys={new Set()}
          positions={FAR}
          selected={selected}
          onSelect={selectNode}
          selectedRel={selectedRel}
          onSelectRel={selectRel}
          onAddElement={() => {}}
          onAddRelation={() => {}}
          onEditRequest={onEditRequest}
          ready={false}
          recentlyAdded={null}
          hideNonEntailsRels={false}
        />
      </>
    );
  }

  /** The view's pan and zoom, off the transform the canvas draws under. */
  const view = (container) => {
    const t = container
      .querySelector("svg g[transform*='scale']")
      .getAttribute("transform");
    const [x, y, z] = t.match(/-?[\d.]+/g).map(Number);
    return { x, y, zoom: z };
  };
  const press = (container, label) =>
    fireEvent.click(
      [...container.querySelectorAll("button")].find((b) => b.textContent === label),
    );
  const nodeOpacity = (svg, id) =>
    [...svg.querySelectorAll("g[transform^='translate(']")]
      .find((g) => g.querySelector(":scope > text")?.textContent === id)
      .style.opacity;

  // The clear area of a 700 × 400 canvas: 24px in from each edge, and 120px
  // from the right, where the add and zoom buttons stand.
  const CLEAR = { left: 24, right: 700 - 120, top: 24, bottom: 400 - 24 };
  const clearCentre = {
    x: (CLEAR.left + CLEAR.right) / 2,
    y: (CLEAR.top + CLEAR.bottom) / 2,
  };

  it("centres an element selected while nowhere on screen", () => {
    const { container } = render(<Follow />);
    press(container, "pick X1");
    expect(view(container)).toEqual({
      x: clearCentre.x - 2000,
      y: clearCentre.y - 100,
      zoom: 1,
    });
  });

  it("moves one only cut off at the edge just far enough to show it whole", () => {
    const { container } = render(<Follow />);
    press(container, "pick E1");
    const r = elementRadius(el("E1"));
    // Its left edge lands on the margin, and nothing moves up or down.
    expect(view(container).x + 10 - r).toBeCloseTo(CLEAR.left);
    expect(view(container).y).toBe(0);
  });

  it("leaves the view alone for an element already in it", () => {
    const { container } = render(<Follow />);
    const svg = container.querySelector("svg");
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "mouse" });
    expect(view(container)).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("brings in a relation's ends — here too far apart to fit, so its middle", () => {
    const { container } = render(<Follow />);
    press(container, "pick relation");
    expect(view(container).x).toBeCloseTo(clearCentre.x - (100 + 2000) / 2);
  });

  it("revises a node on a double-click, and keeps it selected", () => {
    const onEditRequest = vi.fn();
    const { container } = render(<Follow onEditRequest={onEditRequest} />);
    const svg = container.querySelector("svg");
    fireEvent.doubleClick(svg, { clientX: 100, clientY: 100, button: 0 });
    expect(onEditRequest).toHaveBeenCalledWith("J1");
    // Selected, so it lights and the rest fades.
    expect(nodeOpacity(svg, "J1")).toBe("1");
    expect(Number(nodeOpacity(svg, "E1"))).toBeLessThan(1);
  });

  it("fits the whole graph from the button, or a double-click on the background", () => {
    const expected = fitView(FAR, null, { w: 700, h: 400 }, { padding: 96, maxZoom: 1 });
    for (const act of [
      (c) => fireEvent.click(c.querySelector('[aria-label="Fit graph to view"]')),
      (c) =>
        fireEvent.doubleClick(c.querySelector("svg"), {
          clientX: 400,
          clientY: 350,
          button: 0,
        }),
    ]) {
      const { container, unmount } = render(<Follow />);
      act(container);
      const v = view(container);
      expect(v.zoom).toBeCloseTo(expected.zoom);
      expect(v.x).toBeCloseTo(expected.pan.x);
      expect(v.y).toBeCloseTo(expected.pan.y);
      unmount();
    }
  });
});
