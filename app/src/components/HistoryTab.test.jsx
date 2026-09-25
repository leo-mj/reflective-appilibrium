// @vitest-environment jsdom
//
// The History tab's statement view: cards carrying the wording each element
// had in the round being played, on a layout that holds still through
// playback. The canvas itself is the Graph tab's, tested there.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";

import { HistoryTab } from "./HistoryTab.jsx";
import {
  setStatementViewOn,
  statementViewOn,
} from "../utils/statementViewSetting.js";

let frames;
beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  // Where things land, not how they get there: the switch jumps.
  vi.stubGlobal("matchMedia", (q) => ({
    matches: q.includes("prefers-reduced-motion: reduce"),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setStatementViewOn(false);
});

/** Runs animation frames until playback has eased to where it is going. */
function settle() {
  for (let i = 0; i < 400 && frames.length; i++) {
    const due = frames;
    frames = [];
    act(() => due.forEach((cb) => cb(i * 16)));
  }
}

const STATE = {
  topic: "Promises",
  phase: 2,
  round: 4,
  elements: [
    {
      id: "J1",
      type: "judgment",
      status: "active",
      confidence: 1,
      origin: "user",
      // Long enough to run past a card's four lines, so it has somewhere to grow.
      text: "Promises bind even when breaking one would go unnoticed and unpunished, and even when keeping it has become a burden to the one who made it.",
      addedRound: 1,
      history: [{ round: 3, type: "revised", previousText: "Promises bind." }],
    },
    {
      id: "P1",
      type: "principle",
      status: "active",
      confidence: 1,
      origin: "user",
      text: "Keep your word.",
      addedRound: 1,
    },
    {
      id: "J2",
      type: "judgment",
      status: "active",
      confidence: 1,
      origin: "user",
      text: "A late arrival.",
      addedRound: 4,
    },
  ],
  relations: [
    { from: "J1", to: "P1", type: "supports", explanation: "", addedRound: 1 },
  ],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
};
const POSITIONS = {
  J1: { x: 100, y: 100 },
  P1: { x: 400, y: 100 },
  J2: { x: 250, y: 300 },
};

function setup() {
  const utils = render(
    <HistoryTab
      state={STATE}
      positions={POSITIONS}
      onRoundChange={() => {}}
      isWide={false}
      hideNonEntailsRels={false}
    />,
  );
  const { container } = utils;
  const toRound = (round) => {
    fireEvent.change(container.querySelector('input[type="range"]'), {
      target: { value: String(round) },
    });
    settle();
  };
  const card = (id) =>
    [...container.querySelectorAll('[data-testid="statement-card"]')].find((c) =>
      c.textContent.startsWith(id),
    );
  const wording = (id) =>
    [...card(id).querySelectorAll(":scope > text tspan")]
      .map((t) => t.textContent)
      .join(" ");
  const node = (id) => card(id).closest("g[transform^='translate(']");
  const toggle = () =>
    fireEvent.click(container.querySelector('[aria-label="Show element text"]'));
  return { ...utils, toRound, card, wording, node, toggle };
}

describe("the History tab's statement view", () => {
  it("shares the Graph tab's switch", () => {
    const { toggle, card } = setup();
    expect(card("J1")).toBeUndefined();
    toggle();
    expect(statementViewOn()).toBe(true);
    expect(card("J1")).toBeDefined();
  });

  it("shows the wording each element had in the round being played", () => {
    const { toggle, toRound, wording } = setup();
    toggle();
    toRound(2);
    expect(wording("J1")).toBe("Promises bind.");
    toRound(4);
    expect(wording("J1")).toMatch(/^Promises bind even when/);
  });

  it("holds the layout still through playback, revisions and all", () => {
    const { toggle, toRound, node } = setup();
    toggle();
    toRound(2);
    const before = node("J1").getAttribute("transform");
    toRound(4);
    expect(node("J1").getAttribute("transform")).toBe(before);
  });

  it("keeps a card not yet added out of sight, and out of reach", () => {
    const { toggle, toRound, node, container } = setup();
    toggle();
    toRound(2);
    expect(node("J2").style.opacity).toBe("0");
    // Hovering it grows nothing: there is nothing there to read yet.
    fireEvent.mouseEnter(node("J2"));
    expect(
      container.querySelector('[data-testid="statement-card-expanded"]'),
    ).toBeNull();
    toRound(4);
    expect(node("J2").style.opacity).toBe("1");
  });

  it("grows a cut-short card under the pointer, as the Graph tab does", () => {
    const { toggle, toRound, node, container } = setup();
    toggle();
    toRound(4);
    fireEvent.mouseEnter(node("J1"));
    const grown = container.querySelector(
      '[data-testid="statement-card-expanded"]',
    );
    expect(grown).not.toBeNull();
    // Its last line: the whole statement, not four lines of it.
    const lines = [...grown.querySelectorAll("tspan")].map((t) => t.textContent);
    expect(lines.at(-1)).toMatch(/made it\.$/);
  });
});
