import { describe, it, expect } from "vitest";
import { makeRelationDefaults } from "./addPanelShared.js";

const el = (id, status = "active") => ({ id, status });

describe("makeRelationDefaults", () => {
  it("seeds from the first two elements in sort order", () => {
    expect(makeRelationDefaults([el("P1"), el("J2"), el("J1")])).toEqual({
      from: "J1",
      to: "J2",
      type: "supports",
      explanation: "",
    });
  });

  it("skips elements that are not in play", () => {
    // Withdrawn and rejected elements stay selectable, but a form should not
    // open on one.
    const form = makeRelationDefaults([
      el("J1", "withdrawn"),
      el("J2", "rejected"),
      el("J3"),
      el("P1"),
    ]);
    expect(form).toMatchObject({ from: "J3", to: "P1" });
  });

  it("falls back to the whole pool when nothing is in play", () => {
    const form = makeRelationDefaults([
      el("J2", "withdrawn"),
      el("J1", "rejected"),
    ]);
    expect(form).toMatchObject({ from: "J1", to: "J2" });
  });

  it("leaves endpoints blank when there are too few elements", () => {
    expect(makeRelationDefaults([])).toMatchObject({ from: "", to: "" });
    expect(makeRelationDefaults([el("J1")])).toMatchObject({
      from: "J1",
      to: "",
    });
  });
});
