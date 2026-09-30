// Node, not jsdom: the merged case reads the second sample off disk, as
// sample-merge-pairs.test.js does.
//
// rethon reads arguments and nothing else, so an element no argument mentions
// is one no theory can account for. The demo used to leave nine of its
// nineteen active elements there, and Equilibrate on it advised withdrawing
// most of the worked example. Six arguments the Arguments tab offered now
// start in the demo; these tests hold it to that, and to the tab still having
// the other six to show.
import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";
import SAMPLE_STATE from "./sample-state.js";
import { getSampleArguments, argFingerprint } from "./sample-arguments.js";
import { importStateFromFile } from "../utils/importMarkdown.js";
import { mergeStates } from "../utils/mergeStates.js";
import { ARGUMENT_RELATION_TYPES } from "../utils/stateUtils.js";

/** The hosted cap on elements in arguments: `_HOSTED_MAX_ARGUED_ELEMENTS` in backend/config.py. */
const HOSTED_ARGUED_CAP = 24;

const argued = (state) =>
  new Set(
    state.relations
      .filter((r) => ARGUMENT_RELATION_TYPES.has(r.type) && !r.supersededBy)
      .flatMap((r) => [r.from, r.to]),
  );

const holds = (e) => e.status === "active" || e.status === "revised";

describe("the demo's arguments", () => {
  it("tie in all but four of its active elements", () => {
    const inArguments = argued(SAMPLE_STATE);
    const loose = SAMPLE_STATE.elements
      .filter((e) => holds(e) && !inArguments.has(e.id))
      .map((e) => e.id);
    // The four the Arguments tab can still tie in (J2, J8, J13) or none of its
    // suggestions reaches (J4). They count against themselves in a
    // simulation, as an unconnected judgment should.
    expect(loose.sort()).toEqual(["J13", "J2", "J4", "J8"]);
  });

  it("leave the Arguments tab six of its twelve to offer", () => {
    const offered = getSampleArguments(
      SAMPLE_STATE.elements,
      SAMPLE_STATE.round,
      SAMPLE_STATE.relations,
    );
    const shown = offered.num_arguments.map((a) =>
      argFingerprint(a, offered.lookup),
    );
    expect(shown).toHaveLength(6);
    // None of the six now in the state is offered again.
    for (const moved of [
      "P1,T3->J1",
      "P3->J10",
      "P5,P8->J12",
      "P7,T1->P5",
      "P9,T2->J9",
      "P10,P5->¬J5",
    ])
      expect(shown).not.toContain(moved);
  });

  it("stay within the hosted cap, merged with the second sample too", async () => {
    expect(argued(SAMPLE_STATE).size).toBeLessThanOrEqual(HOSTED_ARGUED_CAP);
    const source = readFileSync(
      new URL("./sample-process-climate-duties.md", import.meta.url),
      "utf8",
    );
    const incoming = await importStateFromFile(
      new File([source], "sample-process-climate-duties.md", {
        type: "text/markdown",
      }),
    );
    const merged = mergeStates(SAMPLE_STATE, incoming, { label: "climate-duties" });
    expect(argued(merged).size).toBeLessThanOrEqual(HOSTED_ARGUED_CAP);
  });
});
