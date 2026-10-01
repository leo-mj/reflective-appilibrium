// Node, not jsdom: this reads the sample file off disk, and `import.meta.url`
// is only a file URL outside the browser environment. `File` is Node's own.
//
// The two sample processes are meant to be merged together, and the Merge tab's
// sample suggestions are written for the result. All three drift apart silently
// — an edited wording in either fixture leaves the suggestions matching nothing
// — so this walks the whole path: read the file as the app reads it, merge it,
// and check that the pairs come out.
import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";
import SAMPLE_STATE from "./sample-state.js";
import sampleMergePairs from "./sample-merge-pairs.js";
import { importStateFromFile } from "../utils/importMarkdown.js";
import { mergeStates, processesOf } from "../utils/mergeStates.js";
import { isMergeablePair } from "../utils/elementMerge.js";

const source = readFileSync(
  new URL("./sample-process-climate-duties.md", import.meta.url),
  "utf8",
);

const file = () =>
  new File([source], "sample-process-climate-duties.md", { type: "text/markdown" });

describe("the second sample process", () => {
  it("imports as the app imports it", async () => {
    const state = await importStateFromFile(file());
    expect(state.topic).toBe("What does the climate crisis require of us now?");
    expect(state.round).toBe(4);
    expect(state.elements).toHaveLength(11);
    expect(state.relations).toHaveLength(7);
    // The withdrawn judgment carries its history, so playback reads right.
    const j8 = state.elements.find((e) => e.id === "J8");
    expect(j8.status).toBe("withdrawn");
    expect(j8.history).toEqual([
      { round: 3, type: "withdrawn", reason: expect.stringContaining("J2") },
    ]);
  });

  it("adds to the opening process without anything being fused", async () => {
    const incoming = await importStateFromFile(file());
    const merged = mergeStates(SAMPLE_STATE, incoming, { label: "climate-duties" });

    expect(merged.elements).toHaveLength(SAMPLE_STATE.elements.length + 11);
    expect(merged.relations).toHaveLength(SAMPLE_STATE.relations.length + 7);
    // Nothing is worded identically, so every pair is the reader's to decide.
    expect(merged.log.at(-1).findings).not.toContain("Fused");
    expect(processesOf(merged).map((p) => p.label)).toEqual([
      SAMPLE_STATE.topic,
      "What does the climate crisis require of us now?",
    ]);
    // The joint argument arrives as one argument, not two loose relations.
    const joint = merged.relations.filter((r) => r.type === "jointly_entails" && r.addedRound === merged.round);
    expect(joint).toHaveLength(2);
    expect(new Set(joint.map((r) => r.argumentId)).size).toBe(1);
  });
});

describe("the Merge tab's sample suggestions", () => {
  it("offers the five pairs written for the merged sample", async () => {
    const incoming = await importStateFromFile(file());
    const merged = mergeStates(SAMPLE_STATE, incoming);
    const processes = processesOf(merged);
    const pairs = sampleMergePairs(merged, processes);

    expect(pairs).toHaveLength(5);
    pairs.forEach((p) => {
      expect(isMergeablePair(merged, processes, p.a, p.b)).toBe(true);
      expect(p.reason).not.toBe("");
    });
    // Each names one element from each process, and none is a word-overlap
    // fallback (those say so in their reason).
    pairs.forEach((p) => expect(p.reason).not.toContain("Sample suggestion"));
  });

  it("falls back to word overlap for a process it was not written for", () => {
    const el = (id, text) => ({
      id,
      type: "judgment",
      status: "active",
      confidence: 1,
      text,
      addedRound: 1,
    });
    const other = {
      ...SAMPLE_STATE,
      elements: [el("J1", "Never lie to friends."), el("J2", "Never lie to your friends.")],
      processes: [
        { id: "A", label: "one", members: ["J1"] },
        { id: "B", label: "two", members: ["J2"] },
      ],
    };
    const pairs = sampleMergePairs(other, other.processes);
    expect(pairs).toEqual([
      { a: "J1", b: "J2", reason: expect.stringContaining("Sample suggestion") },
    ]);
  });
});
