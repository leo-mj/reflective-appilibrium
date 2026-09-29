// @vitest-environment jsdom
//
// The argument dialog used to offer Entails or Precludes and the explanation —
// nothing about the premises. Now each premise can be swapped, reworded or
// taken out, and more can be added.
import { vi, describe, it, expect, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";

import { ReviseArgumentModal } from "./ReviseArgumentModal.jsx";

afterEach(cleanup);

const el = (
  id,
  text,
  type = id.startsWith("P") ? "principle" : "judgment",
) => ({
  id,
  type,
  status: "active",
  confidence: 0.7,
  origin: "user",
  text,
  addedRound: 1,
});
const ELEMENTS = [
  el("J7", "Parents owe their own children more."),
  el("P6", "Strength of an obligation is not its existence."),
  el("J10", "Distance does not discount obligations."),
  el("J4", "A floor is owed to everyone."),
];
const link = (from) => ({
  from,
  to: "J10",
  type: "jointly_entails",
  argumentId: "a1",
  explanation: "Together.",
  addedRound: 1,
});
const ARGUMENT = [link("J7"), link("P6")];

function open(onSave = vi.fn()) {
  render(
    <ReviseArgumentModal
      argument={ARGUMENT}
      elements={ELEMENTS}
      currentRound={5}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  return onSave;
}
const save = () => screen.getByRole("button", { name: "Save" });
const premise = (n) => screen.getByRole("textbox", { name: `Premise ${n}` });
function pick(n, id) {
  fireEvent.click(
    screen.getByRole("combobox", { name: `Premise ${n} source` }),
  );
  const listbox = screen.getByRole("listbox", { name: `Premise ${n} source` });
  fireEvent.click(
    within(listbox)
      .getAllByRole("option")
      .find((o) => o.textContent.startsWith(id)),
  );
}

describe("ReviseArgumentModal", () => {
  it("opens on the argument's premises, and offers Save only once something changed", () => {
    open();
    expect(premise(1).value).toBe("Parents owe their own children more.");
    expect(premise(2).value).toBe(
      "Strength of an obligation is not its existence.",
    );
    expect(screen.getByRole("textbox", { name: "Conclusion" }).value).toBe(
      "Distance does not discount obligations.",
    );
    expect(save().disabled).toBe(true);
  });

  it("takes a premise out", () => {
    const onSave = open();
    fireEvent.click(screen.getByRole("button", { name: "Remove premise 2" }));
    fireEvent.click(save());
    expect(onSave.mock.calls[0][0].premises).toEqual([
      { id: "J7", text: "Parents owe their own children more." },
    ]);
  });

  it("adds a premise written as a new statement", () => {
    const onSave = open();
    fireEvent.click(screen.getByRole("button", { name: "+ premise" }));
    expect(save().disabled).toBe(true); // a blank line is not a premise
    expect(document.body.textContent).toContain("Premise 3 needs a statement.");
    fireEvent.change(premise(3), {
      target: { value: "Future people are people." },
    });
    fireEvent.click(save());
    expect(onSave.mock.calls[0][0].premises[2]).toEqual({
      type: "principle",
      text: "Future people are people.",
    });
  });

  it("swaps a premise for another element on the board", () => {
    const onSave = open();
    pick(2, "J4");
    expect(premise(2).value).toBe("A floor is owed to everyone.");
    fireEvent.click(save());
    expect(onSave.mock.calls[0][0].premises[1]).toMatchObject({ id: "J4" });
  });

  it("rewords a premise, and says that revises the element everywhere", () => {
    const onSave = open();
    fireEvent.change(premise(1), {
      target: { value: "Parents owe their children more." },
    });
    expect(document.body.textContent).toContain(
      "Rewording revises J7 everywhere it appears.",
    );
    fireEvent.click(save());
    expect(onSave.mock.calls[0][0].premises[0]).toEqual({
      id: "J7",
      text: "Parents owe their children more.",
    });
  });

  it("refuses the conclusion as a premise, and a premise twice", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "+ premise" }));
    pick(3, "J7");
    expect(document.body.textContent).toContain("J7 is a premise twice.");
    expect(save().disabled).toBe(true);
  });

  it("still turns an argument from entailing to precluding", () => {
    const onSave = open();
    fireEvent.change(screen.getByLabelText("Relation to conclusion"), {
      target: { value: "precludes" },
    });
    fireEvent.click(save());
    expect(onSave.mock.calls[0][0].negated).toBe(true);
  });

  it("swaps the conclusion, but never takes it out", () => {
    const onSave = open();
    expect(
      screen.queryByRole("button", { name: /Remove conclusion/ }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("combobox", { name: "Conclusion source" }),
    );
    const listbox = screen.getByRole("listbox", { name: "Conclusion source" });
    fireEvent.click(
      within(listbox)
        .getAllByRole("option")
        .find((o) => o.textContent.startsWith("J4")),
    );
    fireEvent.click(save());
    expect(onSave.mock.calls[0][0].conclusion).toMatchObject({
      id: "J4",
      text: "A floor is owed to everyone.",
    });
  });

  it("rewords the conclusion, with the same note a premise gets", () => {
    const onSave = open();
    fireEvent.change(screen.getByRole("textbox", { name: "Conclusion" }), {
      target: { value: "Distance never discounts an obligation." },
    });
    expect(document.body.textContent).toContain(
      "Rewording revises J10 everywhere it appears.",
    );
    fireEvent.click(save());
    expect(onSave.mock.calls[0][0].conclusion).toEqual({
      id: "J10",
      text: "Distance never discounts an obligation.",
    });
  });

  it("refuses a premise as the conclusion", () => {
    open();
    fireEvent.click(
      screen.getByRole("combobox", { name: "Conclusion source" }),
    );
    const listbox = screen.getByRole("listbox", { name: "Conclusion source" });
    fireEvent.click(
      within(listbox)
        .getAllByRole("option")
        .find((o) => o.textContent.startsWith("J7")),
    );
    expect(document.body.textContent).toContain(
      "J7 is the conclusion, so it cannot also be a premise.",
    );
    expect(save().disabled).toBe(true);
  });
});
