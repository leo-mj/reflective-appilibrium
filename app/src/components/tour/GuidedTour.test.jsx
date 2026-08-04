// @vitest-environment jsdom
//
// The wide tour is a page the reader scrolls, and the app behind it is expected
// to keep up: the graph frames and selects whatever the section in view is
// talking about, the tab bar stays out of the way until the tour has earned it,
// and everything the tour moved goes back when it is dismissed.
//
// Scrolling itself cannot be exercised here — jsdom has no layout, so every
// section measures at the same place — so these drive the Back/Next controls,
// which is the same path with the measuring step skipped.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { GuidedTour } from "./GuidedTour.jsx";
import { SAMPLE_STATE } from "../../state.js";

beforeEach(() => {
  // The ring is measured a frame after the section changes.
  vi.stubGlobal("requestAnimationFrame", (cb) => {
    cb();
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const openTour = (overrides = {}) => {
  const spies = {
    onClose: vi.fn(),
    onSetTab: vi.fn(),
    onSelectNode: vi.fn(),
    onSelectRel: vi.fn(),
    onSetChrome: vi.fn(),
    onFocusGraph: vi.fn(),
  };
  render(
    <GuidedTour
      active
      state={SAMPLE_STATE}
      isSample
      hideNonEntailsRels
      {...spies}
      {...overrides}
    />,
  );
  return spies;
};

const next = () => fireEvent.click(screen.getByText("Next ↓"));
const back = () => fireEvent.click(screen.getByText("← Back"));

/** Advances until the tour is showing the section titled `title`. */
const walkTo = (title) => {
  for (let i = 0; i < 40; i++) {
    const current = document.querySelector('[aria-current="step"]');
    if (current?.textContent.includes(title)) return;
    // The last section's button ends the tour rather than advancing it.
    if (screen.queryByText("Finish")) break;
    next();
  }
  const current = document.querySelector('[aria-current="step"]')?.textContent;
  throw new Error(`never reached "${title}" — stopped on "${current}"`);
};

/** The argument ids of the last relation handed to onSelectRel. */
const lastSelectedRel = (spies) => {
  const updater = spies.onSelectRel.mock.lastCall?.[0];
  return typeof updater === "function" ? updater() : updater;
};

const lastSelectedNode = (spies) => {
  const updater = spies.onSelectNode.mock.lastCall?.[0];
  return typeof updater === "function" ? updater() : updater;
};

describe("what the reader lands on", () => {
  it("opens on the method, with the app's chrome out of the way", () => {
    const spies = openTour();
    expect(screen.getByText("Reflective equilibrium")).toBeTruthy();
    expect(spies.onSetChrome).toHaveBeenLastCalledWith({
      chrome: false,
      text: false,
    });
  });

  it("shows the whole tour at once, so it can be read by scrolling", () => {
    openTour();
    // Everything is on the page; the sections do not appear one at a time.
    expect(screen.getByText("Reflective equilibrium")).toBeTruthy();
    expect(screen.getByText(/Judgments — the concrete verdicts/)).toBeTruthy();
    expect(screen.getByText(/Assist proposes, you decide/)).toBeTruthy();
  });

  it("marks exactly one section as the one being read", () => {
    openTour();
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });
});

describe("the app follows the section being read", () => {
  it("frames and selects the element a section is about", () => {
    const spies = openTour();
    walkTo("Judgments — the concrete verdicts");

    expect(spies.onFocusGraph).toHaveBeenLastCalledWith(["J1"]);
    expect(lastSelectedNode(spies)).toBe("J1");
  });

  it("selects the whole argument when the section is about one", () => {
    const spies = openTour();
    walkTo("Arguments connect the two");

    const rel = lastSelectedRel(spies);
    expect(rel.argumentId).toBe("arg-sample-4");
    // Premises and conclusion framed together, or the arrow being described
    // runs off the edge of the panel.
    expect(spies.onFocusGraph).toHaveBeenLastCalledWith(["P1", "J3"]);
  });

  it("quotes the elements' own text rather than a copy of it", () => {
    openTour();
    walkTo("Judgments — the concrete verdicts");
    const J1 = SAMPLE_STATE.elements.find((e) => e.id === "J1");
    expect(screen.getByText(J1.text)).toBeTruthy();
  });

  it("brings the chrome back for the sections that are about it", () => {
    const spies = openTour();
    walkTo("Assist proposes, you decide");

    expect(spies.onSetChrome).toHaveBeenLastCalledWith({
      chrome: true,
      text: false,
    });
    expect(spies.onSetTab).toHaveBeenLastCalledWith("elicitJudgments");
  });

  it("rings the control a section points at", () => {
    document.body.innerHTML = '<button data-tutorial="tab-history">x</button>';
    openTour();
    walkTo("History");
    expect(
      document.querySelector('[style*="box-shadow"][style*="position: fixed"]'),
    ).toBeTruthy();
  });

  it("can be read backwards", () => {
    const spies = openTour();
    walkTo("Principles — the general rules");
    back();
    expect(lastSelectedNode(spies)).toBe("J1");
  });
});

describe("leaving", () => {
  it("puts back everything it moved", () => {
    const spies = openTour();
    walkTo("Judgments — the concrete verdicts");
    fireEvent.click(screen.getByText("Skip tour"));

    expect(spies.onSetChrome).toHaveBeenLastCalledWith({
      chrome: true,
      text: true,
    });
    expect(spies.onFocusGraph).toHaveBeenLastCalledWith(null);
    expect(lastSelectedNode(spies)).toBe(null);
    expect(spies.onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const spies = openTour();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(spies.onClose).toHaveBeenCalled();
  });

  it("reopens at the top, without replaying the section it was left on", () => {
    const spies = {
      onClose: vi.fn(),
      onSetTab: vi.fn(),
      onSelectNode: vi.fn(),
      onSelectRel: vi.fn(),
      onSetChrome: vi.fn(),
      onFocusGraph: vi.fn(),
    };
    const tour = (active) => (
      <GuidedTour
        active={active}
        state={SAMPLE_STATE}
        isSample
        hideNonEntailsRels
        {...spies}
      />
    );
    const { rerender } = render(tour(true));
    walkTo("Analyze — where you stand");
    rerender(tour(false));

    spies.onSetChrome.mockClear();
    rerender(tour(true));
    expect(screen.getByText("Reflective equilibrium")).toBeTruthy();
    // The tab bar the last section had asked for must not flash back on.
    expect(spies.onSetChrome.mock.calls).toEqual([
      [{ chrome: false, text: false }],
    ]);
  });

  it("ends on Finish rather than a Next that goes nowhere", () => {
    const spies = openTour();
    walkTo("That's the tour");
    fireEvent.click(screen.getByText("Finish"));
    expect(spies.onClose).toHaveBeenCalled();
  });
});

describe("sections the state cannot support", () => {
  it("drops the ones naming elements that are not there", () => {
    const withoutP1 = {
      ...SAMPLE_STATE,
      elements: SAMPLE_STATE.elements.filter((e) => e.id !== "P1"),
    };
    openTour({ state: withoutP1 });

    // Describing a principle the graph no longer holds is worse than not
    // describing one at all.
    expect(screen.queryByText(/Principles — the general rules/)).toBeNull();
    expect(screen.getByText(/Judgments — the concrete verdicts/)).toBeTruthy();
  });

  it("drops the ones whose argument is gone", () => {
    const withoutArg = {
      ...SAMPLE_STATE,
      relations: SAMPLE_STATE.relations.filter(
        (r) => r.argumentId !== "arg-sample-4",
      ),
    };
    openTour({ state: withoutArg });
    expect(screen.queryByText(/Arguments connect the two/)).toBeNull();
  });

  it("skips the demo chapter entirely on someone's own process", () => {
    openTour({ isSample: false });
    expect(screen.queryByText(/Judgments — the concrete verdicts/)).toBeNull();
    expect(screen.getByText("Reflective equilibrium")).toBeTruthy();
    expect(screen.getByText(/Assist proposes, you decide/)).toBeTruthy();
  });
});
