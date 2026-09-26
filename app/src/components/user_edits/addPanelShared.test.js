import { describe, it, expect } from "vitest";
import {
  checkPickedArgument,
  checkRelation,
  makeRelationDefaults,
} from "./addPanelShared.js";

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

describe("checkRelation", () => {
  it("takes two different ends, and says nothing", () => {
    expect(checkRelation({ from: "J1", to: "P1" }, 2)).toEqual({
      valid: true,
      complaint: null,
    });
  });

  it("refuses a loop, and says why", () => {
    expect(checkRelation({ from: "J1", to: "J1" }, 2)).toEqual({
      valid: false,
      complaint: "From ≠ To",
    });
  });

  it("asks for two elements before anything else", () => {
    expect(checkRelation({ from: "J1", to: "" }, 1)).toEqual({
      valid: false,
      complaint: "Add two elements first",
    });
  });
});

describe("checkPickedArgument", () => {
  const form = (premises, conclusion) => ({ premises, conclusion });

  it("takes distinct premises and a conclusion apart from them", () => {
    expect(checkPickedArgument(form(["J1", "J2"], "P1"), 3)).toEqual({
      valid: true,
      complaint: null,
    });
  });

  it("refuses a premise named twice", () => {
    expect(checkPickedArgument(form(["J1", "J1"], "P1"), 3)).toEqual({
      valid: false,
      complaint: "Premises must differ",
    });
  });

  it("refuses a conclusion that is also a premise", () => {
    expect(checkPickedArgument(form(["J1"], "J1"), 3)).toEqual({
      valid: false,
      complaint: "Premise ≠ conclusion",
    });
  });

  it("refuses an empty picker without complaining about it", () => {
    expect(checkPickedArgument(form(["J1", ""], "P1"), 3)).toEqual({
      valid: false,
      complaint: null,
    });
  });

  it("asks for two elements before anything else", () => {
    expect(checkPickedArgument(form([""], ""), 0)).toEqual({
      valid: false,
      complaint: "Add two elements first",
    });
  });
});
