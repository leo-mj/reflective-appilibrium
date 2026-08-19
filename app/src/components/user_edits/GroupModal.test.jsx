// @vitest-environment jsdom
//
// The dialog is the only place a group's membership can be set exactly — the
// canvas can only ever add to it.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { GroupModal } from "./GroupModal.jsx";

afterEach(cleanup);

const ELEMENTS = [
  { id: "J1", type: "judgment", status: "active", confidence: 1, text: "Torturing is wrong.", addedRound: 1 },
  { id: "J2", type: "judgment", status: "active", confidence: 1, text: "Lying is wrong.", addedRound: 1 },
  { id: "P1", type: "principle", status: "active", confidence: 1, text: "Do no harm.", addedRound: 1 },
];

const GROUPS = [
  { id: "G1", label: "Duties", members: ["J1", "J2"], collapsed: true },
];

function setup({ group = null, groups = GROUPS, onSave = () => {} } = {}) {
  const utils = render(
    <GroupModal
      group={group}
      elements={ELEMENTS}
      groups={groups}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  const tick = (id) =>
    fireEvent.click(
      utils.container.querySelector(
        `[aria-label^="${id}:"]`,
      ),
    );
  const save = () =>
    fireEvent.click(
      [...utils.container.querySelectorAll("button")].find((b) =>
        /^(Save|Create group)$/.test(b.textContent.trim()),
      ),
    );
  const saveButton = () =>
    [...utils.container.querySelectorAll("button")].find((b) =>
      /^(Save|Create group)$/.test(b.textContent.trim()),
    );
  return { ...utils, tick, save, saveButton };
}

describe("creating a group", () => {
  it("will not save until there are two members", () => {
    const { tick, saveButton } = setup();
    expect(saveButton().disabled).toBe(true);
    tick("P1");
    expect(saveButton().disabled).toBe(true);
    tick("J1");
    expect(saveButton().disabled).toBe(false);
  });

  it("reports the picked members and the typed name", () => {
    const onSave = vi.fn();
    const { container, tick, save } = setup({ onSave });

    fireEvent.change(container.querySelector('[aria-label="Group name"]'), {
      target: { value: "Consequences" },
    });
    tick("P1");
    tick("J1");
    save();

    expect(onSave).toHaveBeenCalledWith({
      id: null,
      label: "Consequences",
      members: ["J1", "P1"],
    });
  });

  it("says the ctrl-click shortcut exists", () => {
    // Somebody who opened this dialog does not know about the modifier key.
    const { container } = setup();
    expect(container.textContent).toMatch(/ctrl.*click/i);
  });
});

describe("editing a group", () => {
  it("opens on the group's own name and members", () => {
    const { container } = setup({ group: GROUPS[0] });
    expect(container.querySelector('[aria-label="Group name"]').value).toBe(
      "Duties",
    );
    const ticked = [...container.querySelectorAll("input[type=checkbox]")]
      .filter((c) => c.checked)
      .map((c) => c.getAttribute("aria-label").split(":")[0]);
    expect(ticked).toEqual(["J1", "J2"]);
  });

  it("names the group an element would be taken from", () => {
    // Ticking it moves the element rather than copying it, so say what that
    // costs before it is done.
    const { container } = setup({
      group: { id: "G2", label: "Other", members: ["P1"], collapsed: true },
    });
    expect(container.textContent).toContain("in Duties");
  });

  it("reports the membership as edited, additions and removals alike", () => {
    const onSave = vi.fn();
    const { tick, save } = setup({ group: GROUPS[0], onSave });

    tick("J1"); // out
    tick("P1"); // in
    save();

    expect(onSave).toHaveBeenCalledWith({
      id: "G1",
      label: "Duties",
      members: ["J2", "P1"],
    });
  });

  it("lets an existing group be saved down to nothing, and says so", () => {
    // Which dissolves it — the same as Ungroup, reached from the other side.
    const onSave = vi.fn();
    const { container, tick, save, saveButton } = setup({
      group: GROUPS[0],
      onSave,
    });
    tick("J1");
    tick("J2");

    expect(saveButton().disabled).toBe(false);
    expect(container.textContent).toMatch(/dissolves this group/i);
    save();
    expect(onSave).toHaveBeenCalledWith({
      id: "G1",
      label: "Duties",
      members: [],
    });
  });
});
