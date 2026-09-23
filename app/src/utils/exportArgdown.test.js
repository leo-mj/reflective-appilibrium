import { describe, it, expect } from "vitest";
import { buildArgdown } from "./exportArgdown.js";

const el = (id, type, text, extra = {}) => ({
  id,
  type,
  text,
  status: "active",
  confidence: 0.7,
  origin: "user",
  addedRound: 1,
  ...extra,
});

function makeState(overrides = {}) {
  return {
    topic: "Lying",
    phase: 2,
    round: 4,
    elements: [
      el("J1", "judgment", "Lying to the murderer is permissible."),
      el("J2", "judgment", "Lying for profit is wrong."),
      el("P1", "principle", "Never lie."),
      el("P2", "principle", "Prevent grave harm."),
      el("T1", "theory", "Kantianism"),
    ],
    relations: [],
    coherence: { tensions: [], orphans: [], clusters: [] },
    log: [],
    ...overrides,
  };
}

describe("buildArgdown", () => {
  it("writes each element as a tagged statement carrying its data", () => {
    const ad = buildArgdown(makeState());
    expect(ad).toContain(
      '[J1]: Lying to the murderer is permissible. #judgment {confidence: 0.7, origin: "user", addedRound: 1}',
    );
    expect(ad).toContain("[P1]: Never lie. #principle");
    expect(ad).toContain("[T1]: Kantianism #theory");
    expect(ad).toMatch(/^===\ntitle: "Lying"\n/);
  });

  it("tags a non-active status and leaves possible elements out", () => {
    const ad = buildArgdown(
      makeState({
        elements: [
          el("J1", "judgment", "Kept", { status: "withdrawn" }),
          el("J2", "judgment", "Offered only", { status: "possible" }),
        ],
        relations: [{ from: "J2", to: "J1", type: "supports" }],
      }),
    );
    expect(ad).toContain("[J1]: Kept #judgment #withdrawn");
    expect(ad).not.toContain("J2");
  });

  it("maps dialectical relations onto Argdown's statement relations", () => {
    const ad = buildArgdown(
      makeState({
        relations: [
          { from: "P1", to: "J2", type: "supports", explanation: "direct" },
          { from: "P1", to: "J1", type: "conflicts" },
          { from: "T1", to: "P2", type: "undermines" },
          { from: "P2", to: "T1", type: "depends" },
        ],
      }),
    );
    expect(ad).toContain("  +> [J2] // supports: direct");
    expect(ad).toContain("  -> [J1] // conflicts");
    expect(ad).toContain("  -> [P2] // undermines");
    expect(ad).toContain("  +> [T1] // depends");
  });

  it("keeps withdrawn relations as comments only", () => {
    const ad = buildArgdown(
      makeState({
        relations: [
          { from: "P1", to: "J2", type: "supports", status: "withdrawn" },
        ],
      }),
    );
    expect(ad).not.toContain("+> [J2]");
    expect(ad).toContain("// withdrawn: [P1] supports [J2]");
  });

  it("gathers a joint argument's premises into one premise-conclusion structure", () => {
    const ad = buildArgdown(
      makeState({
        relations: [
          { from: "P2", to: "J1", type: "jointly_entails", argumentId: "a", explanation: "Valid." },
          { from: "T1", to: "J1", type: "jointly_entails", argumentId: "a" },
        ],
      }),
    );
    expect(ad).toContain(
      "<Argument 1>: Valid.\n\n(1) [P2]\n(2) [T1]\n----\n(3) [J1]",
    );
    expect(ad).not.toContain("<Argument 2>");
  });

  it("concludes a precluding argument in a negation contradicting the element, defined once", () => {
    const ad = buildArgdown(
      makeState({
        relations: [
          { from: "P1", to: "J1", type: "precludes", argumentId: "a" },
          { from: "T1", to: "J1", type: "precludes", argumentId: "b" },
        ],
      }),
    );
    expect(ad).toContain(
      "(2) [not J1]: It is not the case that @[J1].\n  >< [J1]",
    );
    expect(ad.match(/\[not J1\]:/g)).toHaveLength(1);
    expect(ad).toContain("<Argument 2>\n\n(1) [T1]\n----\n(2) [not J1]");
  });

  it("comments out a withdrawn argument", () => {
    const ad = buildArgdown(
      makeState({
        relations: [
          { from: "P2", to: "J1", type: "entails", argumentId: "a", status: "withdrawn" },
        ],
      }),
    );
    expect(ad).toContain("// Argument 1 (withdrawn)\n// <Argument 1>");
    expect(ad).not.toMatch(/^\(1\) \[P2\]/m);
  });

  it("defuses text Argdown would read as syntax", () => {
    const ad = buildArgdown(
      makeState({
        elements: [el("J1", "judgment", "A [b] <c> {d} #e // f\nnext line")],
      }),
    );
    expect(ad).toContain("[J1]: A (b) ‹c› (d) ＃e / / f next line #judgment");
  });
});
