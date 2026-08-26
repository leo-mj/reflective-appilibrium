// @vitest-environment jsdom
//
// The panel is where a collapsed group's members are still spelled out — on the
// canvas they are, by design, exactly what you cannot see — so it is also where
// they can be read and taken out again.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, within } from "@testing-library/react";

import { Ctx } from "./TextTabContext.js";
import { GroupSection } from "./TextTabGroupSection.jsx";

afterEach(cleanup);

const STATE = {
  round: 3,
  elements: [
    { id: "J1", type: "judgment", status: "active", confidence: 1, text: "Torturing is wrong.", addedRound: 1 },
    { id: "J2", type: "judgment", status: "active", confidence: 1, text: "Lying is wrong.", addedRound: 1 },
    { id: "P1", type: "principle", status: "active", confidence: 1, text: "Do no harm.", addedRound: 1 },
  ],
  relations: [],
};

const GROUPS = [
  { id: "G1", label: "Duties", members: ["J1", "J2"], collapsed: true },
];

function setup({ groups = GROUPS, ...handlers } = {}) {
  const ctx = {
    state: STATE,
    selected: null,
    onSelect: () => {},
    badgeColor: () => "#888",
    badgeFill: () => "#444",
    badgeTextColor: () => "#888",
    search: "",
    isWide: true,
    onToggleGroup: () => {},
    onEditGroupRequest: () => {},
    onUngroup: () => {},
    onRemoveFromGroup: () => {},
    ...handlers,
  };
  return render(
    <Ctx.Provider value={ctx}>
      <GroupSection
        state={STATE}
        groups={groups}
        sectionRef={{ current: null }}
        collapsed={false}
        onToggle={() => {}}
      />
    </Ctx.Provider>,
  );
}

const byLabel = (container, label) =>
  container.querySelector(`[aria-label="${label}"]`);

describe("the groups section", () => {
  it("spells out what a collapsed group is holding", () => {
    // The one thing the canvas cannot show once the group is a single disc.
    const { container } = setup();
    expect(container.textContent).toContain("Duties");
    expect(container.textContent).toContain("2 members");
    expect(container.textContent).toContain("collapsed");
    expect(container.textContent).toContain("Torturing is wrong.");
    expect(container.textContent).toContain("Lying is wrong.");
  });

  it("says how to make one when there are none", () => {
    // The section renders empty on purpose: it is where someone who has never
    // made a group finds out that they can.
    const { container } = setup({ groups: [] });
    expect(container.textContent).toMatch(/ctrl.*click/i);
    expect(byLabel(container, "New group")).not.toBeNull();
  });

  it("offers the same handles the canvas chips have", () => {
    const onToggleGroup = vi.fn();
    const onEditGroupRequest = vi.fn();
    const onUngroup = vi.fn();
    const { container } = setup({ onToggleGroup, onEditGroupRequest, onUngroup });
    const actions = within(byLabel(container, "Actions for Duties"));

    fireEvent.click(actions.getByText("Expand"));
    expect(onToggleGroup).toHaveBeenCalledWith("G1");

    fireEvent.click(actions.getByText("Edit"));
    expect(onEditGroupRequest).toHaveBeenCalledWith("G1");

    fireEvent.click(actions.getByText("Ungroup"));
    expect(onUngroup).toHaveBeenCalledWith("G1");
  });

  it("reads Collapse for a group that is already expanded", () => {
    const { container } = setup({
      groups: [{ ...GROUPS[0], collapsed: false }],
    });
    const actions = within(byLabel(container, "Actions for Duties"));
    expect(actions.queryByText("Collapse")).not.toBeNull();
    expect(actions.queryByText("Expand")).toBeNull();
  });

  it("takes one member out without opening a dialog", () => {
    const onRemoveFromGroup = vi.fn();
    const { container } = setup({ onRemoveFromGroup });

    fireEvent.click(byLabel(container, "Remove J2 from Duties"));
    expect(onRemoveFromGroup).toHaveBeenCalledWith("J2");
  });

  it("selects the group from its name, as a badge selects an element", () => {
    // Selecting from the text is what focuses the graph, and a group can be
    // selected exactly as an element can.
    const onSelect = vi.fn();
    const { container } = setup({ onSelect });

    fireEvent.click(byLabel(container, "Select group Duties"));
    expect(onSelect).toHaveBeenCalled();
    expect(onSelect.mock.calls[0][0]("something else")).toBe("G1");
    expect(onSelect.mock.calls[0][0]("G1")).toBeNull();
  });

  it("marks the selected group as pressed", () => {
    const { container } = setup({ selected: "G1" });
    expect(
      byLabel(container, "Select group Duties").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("opens the dialog with no group to make a new one", () => {
    const onEditGroupRequest = vi.fn();
    const { container } = setup({ onEditGroupRequest });

    fireEvent.click(byLabel(container, "New group"));
    expect(onEditGroupRequest).toHaveBeenCalledWith();
  });
});
