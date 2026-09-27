// @vitest-environment jsdom
//
// Revising an argument used to offer every relation type for the one premise
// row pressed. Supports, Conflicts or Undermines took the step out of the
// argument, and in the default arguments-only view the argument then seemed to
// have been deleted. An argument is revised whole now, with the two choices
// adding one offers.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { EditRelationModal } from "./EditRelationModal.jsx";

afterEach(cleanup);

const rel = (over = {}) => ({
  from: "J1",
  to: "P1",
  type: "supports",
  explanation: "why",
  addedRound: 1,
  ...over,
});

const optionValues = () =>
  [...screen.getByRole("combobox").querySelectorAll("option")].map((o) => o.value);

describe("revising an argument", () => {
  const argument = [
    rel({ type: "jointly_entails", argumentId: "a1" }),
    rel({ from: "J2", type: "jointly_entails", argumentId: "a1" }),
  ];

  it("offers entails and precludes only", () => {
    render(
      <EditRelationModal
        relation={argument[0]}
        argument={argument}
        currentRound={1}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Revise argument" })).toBeTruthy();
    expect(optionValues()).toEqual(["entails", "precludes"]);
  });

  it("keeps the joint form for several premises", () => {
    const onSave = vi.fn();
    render(
      <EditRelationModal
        relation={argument[0]}
        argument={argument}
        currentRound={1}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "precludes" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith({ type: "jointly_precludes", explanation: "why" });
  });

  it("uses the plain form for one premise", () => {
    const one = [rel({ type: "entails", argumentId: "a2" })];
    const onSave = vi.fn();
    render(
      <EditRelationModal
        relation={one[0]}
        argument={one}
        currentRound={1}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "precludes" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith({ type: "precludes", explanation: "why" });
  });
});

describe("revising a relation", () => {
  it("offers what a two-endpoint form does, and no joint types", () => {
    render(
      <EditRelationModal
        relation={rel()}
        currentRound={1}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(optionValues()).toEqual([
      "supports",
      "conflicts",
      "undermines",
      "entails",
      "precludes",
    ]);
  });

  it("offers only argument steps while other relations are hidden", () => {
    render(
      <EditRelationModal
        relation={rel({ type: "entails" })}
        argumentsOnly
        currentRound={1}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(optionValues()).toEqual(["entails", "precludes"]);
  });

  it("still opens on a hidden type if that is the relation's own", () => {
    render(
      <EditRelationModal
        relation={rel()}
        argumentsOnly
        currentRound={1}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(optionValues()).toEqual(["entails", "precludes", "supports"]);
    expect(screen.getByRole("combobox").value).toBe("supports");
  });
});
