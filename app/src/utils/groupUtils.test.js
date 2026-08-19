import { describe, it, expect } from "vitest";
import {
  createGroup,
  groupHull,
  groupLabelLines,
  groupRadius,
  groupsOf,
  projectGroups,
  removeFromGroups,
  removeGroup,
  renameGroup,
  toggleGroup,
  upsertGroup,
} from "./groupUtils.js";

const el = (id, type = "judgment") => ({
  id,
  type,
  status: "active",
  confidence: 1,
  text: `${id}.`,
  addedRound: 1,
});

const rel = (from, to, type = "supports", extra = {}) => ({
  from,
  to,
  type,
  explanation: "",
  addedRound: 1,
  ...extra,
});

const ELEMENTS = ["J1", "J2", "J3", "P1"].map((id) =>
  el(id, id.startsWith("P") ? "principle" : "judgment"),
);
const POSITIONS = {
  J1: { x: 0, y: 0 },
  J2: { x: 100, y: 0 },
  J3: { x: 50, y: 100 },
  P1: { x: 400, y: 400 },
};
const RADIUS = () => 10;

/** Shorthand for the one call every projection test makes. */
const project = (groups, relations = [], elements = ELEMENTS) =>
  projectGroups({
    elements,
    relations,
    groups,
    positions: POSITIONS,
    radiusOf: RADIUS,
  });

const collapsed = (members, id = "G1") => [
  { id, label: id, members, collapsed: true },
];

describe("groupsOf", () => {
  it("reads a state written before groups existed as having none", () => {
    expect(groupsOf({ elements: [] })).toEqual([]);
    expect(groupsOf(undefined)).toEqual([]);
  });
});

describe("createGroup", () => {
  it("needs two elements to make a group", () => {
    expect(createGroup([], ["J1"])).toEqual([]);
    // The same node twice is one node.
    expect(createGroup([], ["J1", "J1"])).toEqual([]);
  });

  it("names and numbers a new group, collapsed", () => {
    // Collapsed on arrival: grouping is asked for to tidy the canvas, so a
    // group that changed nothing about it would not have answered the request.
    const [g] = createGroup([], ["J1", "J2"]);
    expect(g).toMatchObject({
      id: "G1",
      label: "Group 1",
      members: ["J1", "J2"],
      collapsed: true,
    });
  });

  it("numbers past the groups already there", () => {
    const groups = createGroup(createGroup([], ["J1", "J2"]), ["J3", "P1"]);
    expect(groups.map((g) => g.id)).toEqual(["G1", "G2"]);
  });

  it("adds to the existing group when the selection touches one", () => {
    // This is what makes "pick a node and one of the members, then Group" read
    // as adding to the group rather than starting a rival one.
    const groups = createGroup(createGroup([], ["J1", "J2"]), ["J2", "J3"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toEqual(["J1", "J2", "J3"]);
  });

  it("merges two groups a selection spans, keeping the first one's name", () => {
    let groups = createGroup([], ["J1", "J2"]);
    groups = createGroup(groups, ["J3", "P1"]);
    groups = renameGroup(groups, "G1", "Consequences");

    const merged = createGroup(groups, ["J1", "J3"]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("G1");
    expect(merged[0].label).toBe("Consequences");
    expect(merged[0].members.sort()).toEqual(["J1", "J2", "J3", "P1"]);
  });

  it("leaves an element in at most one group", () => {
    let groups = createGroup([], ["J1", "J2"]);
    groups = createGroup(groups, ["J1", "J3"]);
    const seen = groups.flatMap((g) => g.members);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("removeGroup / removeFromGroups / toggleGroup / renameGroup", () => {
  const groups = createGroup([], ["J1", "J2", "J3"]);

  it("dissolves a group without touching its members", () => {
    expect(removeGroup(groups, "G1")).toEqual([]);
    expect(removeGroup(groups, "G9")).toEqual(groups);
  });

  it("takes one element out", () => {
    expect(removeFromGroups(groups, "J2")[0].members).toEqual(["J1", "J3"]);
  });

  it("dissolves a group left with one member", () => {
    const two = createGroup([], ["J1", "J2"]);
    expect(removeFromGroups(two, "J2")).toEqual([]);
  });

  it("toggles and forces the collapsed flag", () => {
    expect(toggleGroup(groups, "G1")[0].collapsed).toBe(false);
    expect(toggleGroup(groups, "G1", true)[0].collapsed).toBe(true);
  });

  it("falls back to the id rather than an empty name", () => {
    expect(renameGroup(groups, "G1", "  ")[0].label).toBe("G1");
    expect(renameGroup(groups, "G1", " Duties ")[0].label).toBe("Duties");
  });
});

describe("groupRadius", () => {
  it("grows with membership, and stops", () => {
    expect(groupRadius(5)).toBeGreaterThan(groupRadius(2));
    expect(groupRadius(200)).toBeLessThan(groupRadius(2) * 3);
  });
});

describe("groupHull", () => {
  it("clears the outermost member on every side", () => {
    const box = groupHull(["J1", "J2", "J3"], POSITIONS, RADIUS);
    expect(box.x).toBeLessThan(-RADIUS());
    expect(box.y).toBeLessThan(-RADIUS());
    expect(box.x + box.w).toBeGreaterThan(100 + RADIUS());
    expect(box.y + box.h).toBeGreaterThan(100 + RADIUS());
  });

  it("has nothing to draw for members with no position yet", () => {
    expect(groupHull(["Z9"], POSITIONS, RADIUS)).toBeNull();
  });
});

describe("projectGroups — expanded groups", () => {
  it("changes nothing but adds a hull", () => {
    const relations = [rel("J1", "J2"), rel("J2", "P1")];
    const out = project(
      [{ id: "G1", label: "G1", members: ["J1", "J2"], collapsed: false }],
      relations,
    );
    expect(out.elements).toEqual(ELEMENTS);
    expect(out.relations).toEqual(relations);
    expect(out.groupNodes).toEqual([]);
    expect(out.hulls).toHaveLength(1);
    expect(out.hulls[0].group.id).toBe("G1");
  });
});

describe("projectGroups — collapsed groups", () => {
  it("replaces the members with one node at their centroid", () => {
    const out = project(collapsed(["J1", "J2"]));
    expect(out.elements.map((e) => e.id)).toEqual(["J3", "P1", "G1"]);
    expect(out.groupNodes[0]).toMatchObject({
      id: "G1",
      type: "group",
      memberIds: ["J1", "J2"],
    });
    expect(out.positions.G1).toEqual({ x: 50, y: 0 });
    // The members keep their own positions; the simulation still owns them.
    expect(out.positions.J1).toEqual(POSITIONS.J1);
    expect(out.hulls).toEqual([]);
  });

  it("drops relations internal to the group", () => {
    const out = project(collapsed(["J1", "J2"]), [rel("J1", "J2")]);
    expect(out.relations).toEqual([]);
  });

  it("keeps every relation crossing the boundary, re-pointed at the group", () => {
    // The whole point of collapsing: nothing a member said about the rest of
    // the graph may be lost by tidying it away.
    const relations = [rel("J1", "P1"), rel("J2", "P1"), rel("J3", "J1")];
    const out = project(collapsed(["J1", "J2"]), relations);

    expect(out.relations).toHaveLength(3);
    expect(out.relations.map((r) => [r.from, r.to])).toEqual([
      ["G1", "P1"],
      ["G1", "P1"],
      ["J3", "G1"],
    ]);
  });

  it("keeps parallel crossings apart, and traceable to their originals", () => {
    // Five members supporting the same element still read as five reasons.
    const relations = [rel("J1", "P1"), rel("J2", "P1")];
    const out = project(collapsed(["J1", "J2"]), relations);

    const keys = out.relations.map((r) => `${r.sourceFrom}-${r.sourceTo}`);
    expect(new Set(keys).size).toBe(2);
    expect(out.relations.map((r) => out.relSource.get(r))).toEqual(relations);
  });

  it("leaves an untouched relation as the very object it was given", () => {
    // Selection compares relations by identity, so a relation the projection
    // had no reason to rewrite must not become a copy.
    const untouched = rel("J3", "P1");
    const out = project(collapsed(["J1", "J2"]), [untouched]);
    expect(out.relations[0]).toBe(untouched);
    expect(out.relSource.get(untouched)).toBeUndefined();
  });

  it("carries the relation's own fields onto the re-pointed edge", () => {
    const out = project(collapsed(["J1", "J2"]), [
      rel("J1", "P1", "jointly_entails", {
        argumentId: "arg-7",
        status: "withdrawn",
      }),
    ]);
    expect(out.relations[0]).toMatchObject({
      type: "jointly_entails",
      argumentId: "arg-7",
      status: "withdrawn",
    });
  });

  it("ignores members the caller has already filtered out", () => {
    // The legend can hide a whole group's members; what is left has to be
    // consistent with the relations, which were filtered the same way.
    const visible = ELEMENTS.filter((e) => e.id !== "J1");
    const out = project(collapsed(["J1", "J2"]), [rel("J2", "P1")], visible);
    expect(out.groupNodes[0].memberIds).toEqual(["J2"]);
    expect(out.relations[0].from).toBe("G1");
  });

  it("drops a group whose every member is hidden", () => {
    const visible = ELEMENTS.filter((e) => e.id === "P1");
    const out = project(collapsed(["J1", "J2"]), [], visible);
    expect(out.groupNodes).toEqual([]);
    expect(out.elements).toEqual(visible);
  });
});

describe("upsertGroup", () => {
  const two = createGroup([], ["J1", "J2"]);

  it("creates a group from an exact list", () => {
    expect(upsertGroup([], { label: "Duties", members: ["J1", "J3"] })).toEqual([
      { id: "G1", label: "Duties", members: ["J1", "J3"], collapsed: true },
    ]);
  });

  it("falls back to a numbered name and keeps the collapsed state", () => {
    const expanded = toggleGroup(two, "G1", false);
    const saved = upsertGroup(expanded, {
      id: "G1",
      label: "  ",
      members: ["J1", "J2"],
    });
    // Editing a group must not undo the user's having just expanded it.
    expect(saved[0]).toMatchObject({ label: "G1", collapsed: false });
  });

  it("replaces the membership rather than adding to it", () => {
    // Unlike `createGroup`, which folds a vague canvas selection into whatever
    // it touches. A dialog's list is exact.
    const saved = upsertGroup(two, { id: "G1", members: ["J2", "J3"] });
    expect(saved[0].members).toEqual(["J2", "J3"]);
  });

  it("moves an element out of the group that had it", () => {
    // An element is in at most one group, so ticking it here unticks it there.
    let groups = createGroup([], ["J1", "J2", "J3"]);
    groups = createGroup(groups, ["P1", "P2"]);
    const saved = upsertGroup(groups, { id: "G2", members: ["P1", "P2", "J1"] });

    expect(saved.find((g) => g.id === "G1").members).toEqual(["J2", "J3"]);
    expect(saved.find((g) => g.id === "G2").members).toContain("J1");
  });

  it("dissolves a group the move leaves with one member", () => {
    let groups = createGroup([], ["J1", "J2"]);
    groups = createGroup(groups, ["J3", "P1"]);
    // G1 keeps only J2, which is not a group.
    const saved = upsertGroup(groups, { id: "G2", members: ["J3", "P1", "J1"] });
    expect(saved.map((g) => g.id)).toEqual(["G2"]);
  });

  it("dissolves the group it is saving when too few members are left", () => {
    expect(upsertGroup(two, { id: "G1", members: ["J1"] })).toEqual([]);
  });

  it("creates nothing from a list too short to be a group", () => {
    expect(upsertGroup([], { members: ["J1"] })).toEqual([]);
  });
});

describe("groupLabelLines", () => {
  it("leaves a short name on one line", () => {
    expect(groupLabelLines("Duties")).toEqual(["Duties"]);
  });

  it("wraps on a word boundary", () => {
    expect(groupLabelLines("Duties to strangers")).toEqual([
      "Duties to",
      "strangers",
    ]);
  });

  it("ellipsises what will not fit in two lines", () => {
    const lines = groupLabelLines(
      "Duties owed to future generations of strangers",
    );
    expect(lines).toHaveLength(2);
    expect(lines.at(-1).endsWith("…")).toBe(true);
  });

  it("cuts a single unbreakable word rather than dropping it", () => {
    expect(groupLabelLines("Supererogatoriness")).toEqual([
      "Supererogat…",
    ]);
  });

  it("always has a line to draw", () => {
    expect(groupLabelLines("")).toEqual([""]);
    expect(groupLabelLines(undefined)).toEqual([""]);
  });
});

describe("groupRadius with a label", () => {
  it("widens the disc to hold a name membership alone would not need", () => {
    // A name that fits the smallest disc does not change it; one that needs
    // both lines at full width does.
    expect(groupRadius(2, "Duties")).toBe(groupRadius(2));
    expect(groupRadius(2, "Duties to all strangers")).toBeGreaterThan(
      groupRadius(2),
    );
  });

  it("stays bounded, because the name is", () => {
    const runaway = groupRadius(2, "x".repeat(400));
    expect(runaway).toBeLessThan(groupRadius(2) * 2);
  });

  it("still grows with membership once the name fits", () => {
    expect(groupRadius(12, "Duties")).toBeGreaterThan(groupRadius(2, "Duties"));
  });
});
