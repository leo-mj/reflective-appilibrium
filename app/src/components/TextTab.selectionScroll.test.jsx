// @vitest-environment jsdom
//
// Selecting puts what was selected at the top of the text panel, so the panel
// has to go there too; letting go brings back the list, and with it the place
// the reader had scrolled to.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

import { TextTab } from "./TextTab.jsx";

const el = (id, type = "judgment") => ({
  id,
  type,
  status: "active",
  confidence: 0.7,
  origin: "user",
  text: `Statement ${id}.`,
  addedRound: 1,
});
const STATE = {
  topic: "t",
  phase: 2,
  round: 3,
  elements: [el("J1"), el("J2"), el("P1", "principle")],
  relations: [
    { from: "J1", to: "P1", type: "supports", explanation: "", addedRound: 2 },
  ],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
};

let calls;
let frames;
beforeEach(() => {
  calls = [];
  frames = [];
  Element.prototype.scrollTo = function (opts) {
    calls.push({ box: this, ...opts });
  };
  vi.stubGlobal("requestAnimationFrame", (cb) => frames.push(cb));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete Element.prototype.scrollTo;
});

const panel = (props) => (
  <TextTab
    state={STATE}
    isWide
    onSelect={() => {}}
    onSelectRel={() => {}}
    {...props}
  />
);

describe("the text panel on a selection", () => {
  it("goes to the top, where the selected card is", () => {
    const { rerender } = render(panel({ selected: null }));
    calls = [];
    rerender(panel({ selected: "J2" }));
    expect(calls.at(-1)).toMatchObject({ top: 0 });
  });

  it("goes to the top for a relation too", () => {
    const { rerender } = render(panel({ selected: null }));
    calls = [];
    rerender(panel({ selectedRel: STATE.relations[0] }));
    expect(calls.at(-1)).toMatchObject({ top: 0 });
  });

  it("comes back to where the reader was, on letting go", () => {
    const { rerender } = render(panel({ selected: null }));
    // Where the reader had scrolled before selecting.
    const scroller = [...document.querySelectorAll("div")].find(
      (d) => d.style.overflowY === "auto",
    );
    scroller.scrollTop = 420;
    rerender(panel({ selected: "J2" }));
    rerender(panel({ selected: "J1" })); // a second pick keeps the first place
    calls = [];
    rerender(panel({ selected: null }));
    act(() => frames.forEach((cb) => cb()));
    expect(calls.at(-1)).toMatchObject({ top: 420 });
  });
});
