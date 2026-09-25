import { describe, it, expect } from "vitest";
import { importArgdownFromFile, isArgdownFile } from "./importArgdown.js";
import { buildArgdown } from "./exportArgdown.js";

const read = (text, name = "paper.argdown") =>
  importArgdownFromFile(new File([text], name, { type: "text/plain" }));

const byText = (state, text) => state.elements.find((e) => e.text === text);

/** Relations grouped by argumentId, as sorted `from>to:type` strings. */
function argumentsOf(state) {
  const groups = new Map();
  for (const r of state.relations.filter((r) => r.argumentId)) {
    if (!groups.has(r.argumentId)) groups.set(r.argumentId, []);
    groups.get(r.argumentId).push(`${r.from}>${r.to}:${r.type}`);
  }
  return [...groups.values()].map((g) => g.sort().join(" ")).sort();
}

describe("isArgdownFile", () => {
  it("goes by the extension", () => {
    expect(isArgdownFile({ name: "paper.argdown" })).toBe(true);
    expect(isArgdownFile({ name: "Paper.AD" })).toBe(true);
    expect(isArgdownFile({ name: "re-lying.md" })).toBe(false);
  });
});

describe("importArgdownFromFile", () => {
  it("reads a hand-written map: types from tags, judgments by default", async () => {
    const state = await read(`===
title: Lying and harm
===

[Kant]: Never lie. #principle {confidence: 0.9}
  -> [Murderer]

[Murderer]: Lying to the murderer at the door is permissible.

[Consequentialism]: Only outcomes matter. #theory
  +> [Murderer]
`);
    expect(state.topic).toBe("Lying and harm");
    expect(state.round).toBe(1);
    const kant = byText(state, "Never lie.");
    const murderer = byText(
      state,
      "Lying to the murderer at the door is permissible.",
    );
    const conseq = byText(state, "Only outcomes matter.");
    expect(kant).toMatchObject({
      id: "P1",
      type: "principle",
      confidence: 0.9,
      status: "active",
      origin: "user",
    });
    expect(murderer).toMatchObject({
      id: "J1",
      type: "judgment",
      confidence: 0.67,
    });
    expect(conseq).toMatchObject({ id: "T1", type: "theory" });
    expect(state.relations).toEqual([
      {
        from: "P1",
        to: "J1",
        type: "conflicts",
        explanation: "",
        addedRound: 1,
      },
      {
        from: "T1",
        to: "J1",
        type: "supports",
        explanation: "",
        addedRound: 1,
      },
    ]);
    const [entry] = state.log;
    expect(entry.decision).toBe("Imported");
    expect(entry.findings).toContain(
      "1 statement without #judgment, #principle or #theory was read as a judgment",
    );
    expect(entry.changes).toContain("[Kant] → P1");
    expect(entry.changes).toContain("[Murderer] → J1");
  });

  it("turns each inference step into its own argument", async () => {
    const state = await read(`
<Door>: The murderer case.

(1) [P]: Lying is wrong when it wrongs the one lied to. #principle
(2) [Q]: The murderer is not wronged by the lie.
-- modus tollens --
(3) [R]: Lying to the murderer is not wrong.
(4) [S]: What is not wrong is permissible. #principle
----
(5) [T]: Lying to the murderer is permissible.
`);
    const id = (t) => state.elements.find((e) => e.text.startsWith(t)).id;
    expect(argumentsOf(state)).toEqual(
      [
        [
          `${id("Lying is wrong")}>${id("Lying to the murderer is not")}:jointly_entails`,
          `${id("The murderer")}>${id("Lying to the murderer is not")}:jointly_entails`,
        ]
          .sort()
          .join(" "),
        [
          `${id("Lying to the murderer is not")}>${id("Lying to the murderer is perm")}:jointly_entails`,
          `${id("What is not")}>${id("Lying to the murderer is perm")}:jointly_entails`,
        ]
          .sort()
          .join(" "),
      ].sort(),
    );
    const first = state.relations.find(
      (r) => r.to === id("Lying to the murderer is not"),
    );
    expect(first.explanation).toBe(
      "The murderer case. Inference: modus tollens.",
    );
  });

  it("honours explicit premises on an inference line", async () => {
    const state = await read(`
<A>

(1) [a]: First.
(2) [b]: Second.
-- {uses: [1]} --
(3) [c]: Third.
`);
    const [rel] = state.relations;
    expect(state.relations).toHaveLength(1);
    expect(rel).toMatchObject({
      from: byText(state, "First.").id,
      to: byText(state, "Third.").id,
      type: "entails",
    });
  });

  it("makes an argument without structure an element", async () => {
    const state = await read(`
[Thesis]: Lying is sometimes permissible. #judgment

<Objection>: Every lie erodes trust. #principle
  -> [Thesis]
`);
    const objection = byText(state, "Every lie erodes trust.");
    expect(objection.type).toBe("principle");
    expect(state.relations).toEqual([
      expect.objectContaining({
        from: objection.id,
        to: byText(state, "Lying is sometimes permissible.").id,
        type: "conflicts",
      }),
    ]);
  });

  it("counts what it cannot carry instead of dropping it silently", async () => {
    const state = await read(`
<A>: Gist.

(1) [p]: Premise.
----
(2) [c]: Conclusion.

<U>: The inference fails.
  _> <A>

[x]: Some statement.
  -> <A>
`);
    const { findings } = state.log[0];
    expect(findings).toContain("1 undercut (_>) left out");
    expect(findings).toContain(
      "1 relation to or from a whole reconstructed argument left out",
    );
  });

  describe("statement relations follow the interpretation mode", () => {
    const body = `[a]: A.
  +> [b]
  -> [c]
  >< [d]

[b]: B.

[c]: C.

[d]: D.
`;
    const typesOf = (state) =>
      state.relations.map((r) => `${r.from}>${r.to}:${r.type}`);

    it("reads loose mode, the default, as the dialectical relations", async () => {
      const state = await read(body);
      expect(typesOf(state)).toEqual([
        "J1>J2:supports",
        "J1>J3:conflicts",
        "J1>J4:precludes",
      ]);
      const [support, attack, contradiction] = state.relations;
      expect(support.argumentId).toBeUndefined();
      expect(attack.argumentId).toBeUndefined();
      expect(contradiction.argumentId).toBeTruthy();
      expect(state.log[0].changes).toContain("Read in loose mode (the default).");
    });

    it("reads strict mode as the inferential ones, one argument each", async () => {
      const state = await read(`===
model:
  mode: strict
===

${body}`);
      expect(typesOf(state)).toEqual([
        "J1>J2:entails",
        "J1>J3:precludes",
        "J1>J4:precludes",
      ]);
      const ids = state.relations.map((r) => r.argumentId);
      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(3);
      expect(state.log[0].changes).toContain("Read in strict mode.");
    });

    it("says what a contradiction loses", async () => {
      const state = await read(body);
      expect(state.log[0].findings).toContain(
        '1 contradiction (><) read as precludes, which keeps only its "not both true" half: the "not both false" half has no counterpart here.',
      );
    });

    it("does not repeat an argument a premise-conclusion structure holds", async () => {
      const state = await read(`===
model:
  mode: strict
===

<A>

(1) [p]: Premise.
----
(2) [c]: Conclusion.

[p]
  +> [c]
`);
      expect(typesOf(state)).toEqual(["J1>J2:entails"]);
    });
  });

  describe("headings as groups", () => {
    it("makes a heading a group, collapsed when it says isClosed", async () => {
      const state = await read(`
# Energy use {isClosed: true}

[a]: A. #judgment

[b]: B. #principle

# Loose ends

[c]: C.

[d]: D.
`);
      expect(state.groups).toEqual([
        { id: "G1", label: "Energy use", members: ["J1", "P1"], collapsed: true },
        { id: "G2", label: "Loose ends", members: ["J2", "J3"], collapsed: false },
      ]);
      expect(state.log[0].changes).toContain(
        'Grouped by heading: "Energy use", "Loose ends".',
      );
    });

    it("leaves out a heading that says isGroup: false, and one over a single statement", async () => {
      const state = await read(`
# Chapter {isGroup: false}

[a]: A.

[b]: B.

# Alone

[c]: C.
`);
      expect(state).not.toHaveProperty("groups");
      expect(state.log[0].findings).toContain(
        "1 heading over a single statement was not made a group.",
      );
    });

    it("gives a nested heading a group of its own", async () => {
      const state = await read(`
# Outer

[a]: A.

[b]: B.

## Inner

[c]: C.

[d]: D.
`);
      expect(state.groups.map((g) => [g.label, g.members])).toEqual([
        ["Outer", ["J1", "J2"]],
        ["Inner", ["J3", "J4"]],
      ]);
      expect(state.log[0].findings).toContain(
        "1 nested heading became a group of its own: groups here do not nest.",
      );
    });

    it("reads statements under a non-group heading into the group above it", async () => {
      const state = await read(`
# Outer

[a]: A.

## Aside {isGroup: false}

[b]: B.
`);
      expect(state.groups).toEqual([
        expect.objectContaining({ label: "Outer", members: ["J1", "J2"] }),
      ]);
    });
  });

  it("reads the exporter's negation into the argument, not as a relation", async () => {
    const state = await read(`
[J1]: Lying to the murderer is permissible. #judgment

[P1]: Never lie. #principle

<Argument 1>

(1) [P1]
----
(2) [not J1]: It is not the case that @[J1].
  >< [J1]
`);
    expect(state.elements.map((e) => e.id).sort()).toEqual(["J1", "P1"]);
    expect(state.relations).toEqual([
      expect.objectContaining({ from: "P1", to: "J1", type: "precludes" }),
    ]);
    expect(state.log[0].findings).not.toContain("contradiction");
  });

  it("refuses a file with a syntax error, naming the line", async () => {
    await expect(
      read("[a]: Fine.\n\n(1) [b]: Premise\n----\n"),
    ).rejects.toThrow(/Argdown syntax error/);
  });

  it("refuses a file with nothing in it", async () => {
    await expect(read("# Just a heading\n")).rejects.toThrow(
      /No statements or arguments/,
    );
  });
});

describe("round trip through exportArgdown", () => {
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

  it("brings back ids, types, statuses, confidences and arguments", async () => {
    const original = {
      topic: "Lying",
      phase: 2,
      round: 4,
      elements: [
        el("J1", "judgment", "Lying to the murderer is permissible."),
        el("J2", "judgment", "Lying for profit is wrong.", {
          status: "withdrawn",
          confidence: 0.33,
        }),
        el("P1", "principle", "Never lie."),
        el("P2", "principle", "Prevent grave harm."),
        el("T1", "theory", "Kantianism", { origin: "GPT+user" }),
      ],
      relations: [
        {
          from: "T1",
          to: "P1",
          type: "supports",
          explanation: "",
          addedRound: 1,
        },
        {
          from: "P2",
          to: "P1",
          type: "conflicts",
          explanation: "",
          addedRound: 1,
        },
        {
          from: "P1",
          to: "J1",
          type: "precludes",
          explanation: "Kant",
          addedRound: 2,
          argumentId: "a1",
        },
        {
          from: "P2",
          to: "J1",
          type: "jointly_entails",
          explanation: "",
          addedRound: 3,
          argumentId: "a2",
        },
        {
          from: "J2",
          to: "J1",
          type: "jointly_entails",
          explanation: "",
          addedRound: 3,
          argumentId: "a2",
        },
      ],
      coherence: { tensions: [], orphans: [], clusters: [] },
      log: [],
    };
    const state = await read(buildArgdown(original), "re-lying-round4.argdown");

    expect(state.topic).toBe("Lying");
    expect(
      state.elements.map(({ id, type, status, confidence, origin, text }) => ({
        id,
        type,
        status,
        confidence,
        origin,
        text,
      })),
    ).toEqual(
      original.elements.map(
        ({ id, type, status, confidence, origin, text }) => ({
          id,
          type,
          status,
          confidence,
          origin,
          text,
        }),
      ),
    );
    expect(state.log[0].changes).not.toContain("Renamed");

    const plain = state.relations
      .filter((r) => !r.argumentId)
      .map((r) => `${r.from}>${r.to}:${r.type}`);
    expect(plain.sort()).toEqual(["P2>P1:conflicts", "T1>P1:supports"]);
    expect(argumentsOf(state)).toEqual([
      "J2>J1:jointly_entails P2>J1:jointly_entails",
      "P1>J1:precludes",
    ]);
    expect(
      state.relations.find((r) => r.type === "precludes").explanation,
    ).toBe("Kant");
    // The `not J1` statement standing in for the negation is not an element.
    expect(state.elements.some((e) => /not the case/.test(e.text))).toBe(false);
    expect(state.log[0].findings).toBe("Imported from Argdown.");
  });

  it("brings back groups, across types, with their labels and collapse", async () => {
    const original = {
      topic: "Lying",
      phase: 2,
      round: 2,
      elements: [
        el("J1", "judgment", "Lying to the murderer is permissible."),
        el("J2", "judgment", "Lying for profit is wrong."),
        el("J3", "judgment", "White lies are fine."),
        el("P1", "principle", "Never lie."),
        el("P2", "principle", "Prevent grave harm."),
        el("J4", "judgment", "Offered only", { status: "possible" }),
      ],
      relations: [],
      groups: [
        // A label with Argdown syntax in it, and a group of two that loses a
        // `possible` member and so is not exported as a group at all.
        { id: "G1", label: "Kant [strict] #1", members: ["P1", "J2"], collapsed: true },
        { id: "G2", label: "Harm", members: ["P2", "J1"], collapsed: false },
        { id: "G3", label: "Gone", members: ["J3", "J4"], collapsed: false },
      ],
      coherence: { tensions: [], orphans: [], clusters: [] },
      log: [],
    };
    const state = await read(buildArgdown(original), "re-lying-round2.argdown");
    expect(state.groups).toEqual([
      { id: "G1", label: "Kant (strict) ＃1", members: ["J2", "P1"], collapsed: true },
      { id: "G2", label: "Harm", members: ["J1", "P2"], collapsed: false },
    ]);
    expect(state.elements.map((e) => e.id).sort()).toEqual([
      "J1",
      "J2",
      "J3",
      "P1",
      "P2",
    ]);
  });
});
