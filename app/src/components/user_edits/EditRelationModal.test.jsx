// @vitest-environment jsdom
//
// Revising a relation that is not an argument step. An argument has a dialog
// of its own, ReviseArgumentModal, which takes its premises too.
import { describe, it, expect, afterEach } from "vitest";
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

  it("offers Save only once a field has changed", () => {
    render(
      <EditRelationModal relation={rel()} currentRound={1} onSave={() => {}} onCancel={() => {}} />,
    );
    const save = () => screen.getByRole("button", { name: "Save" });
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "why not" } });
    expect(save().disabled).toBe(false);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "why" } });
    expect(save().disabled).toBe(true);
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
