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
import { TOUR_Z } from "./tourZ.js";
import { SAMPLE_STATE } from "../../state.js";

beforeEach(() => {
  // The ring is measured a frame after the section changes.
  vi.stubGlobal("requestAnimationFrame", (cb) => {
    cb();
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  // jsdom has no scrolling to do, and does not implement the call.
  Element.prototype.scrollTo = () => {};
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

/** The spotlight: one grey sheet with a hole cut for each ringed control. */
const ring = () => document.querySelector(`[style*="z-index: ${TOUR_Z.ring}"]`);
/** How many controls it is pointing at — one ring drawn per hole. */
const holes = () => ring()?.querySelectorAll("mask rect").length - 1;

const next = () => fireEvent.click(screen.getByText("Next ↓"));
const back = () => fireEvent.click(screen.getByText("← Back"));

/** The heading of the section being read. Matched on rather than the whole
 *  section, whose prose mentions other sections by name. */
const currentTitle = () =>
  document.querySelector('[aria-current="step"] h3')?.textContent ?? "";

/** Advances until the tour is showing the section titled `title`. */
const walkTo = (title) => {
  for (let i = 0; i < 40; i++) {
    if (currentTitle().includes(title)) return;
    // The last section's button ends the tour rather than advancing it.
    if (screen.queryByText("Finish")) break;
    next();
  }
  throw new Error(`never reached "${title}" — stopped on "${currentTitle()}"`);
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
      menu: false,
      addBar: false,
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
    expect(rel.argumentId).toBe("arg-sample-3");
    // Premises and conclusion framed together, or the arrow being described
    // runs off the edge of the panel.
    expect(spies.onFocusGraph).toHaveBeenLastCalledWith(["P2", "P3", "J5"]);
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
      menu: false,
      addBar: false,
    });
    expect(spies.onSetTab).toHaveBeenLastCalledWith("elicitJudgments");
  });

  it("rings the control a section points at", () => {
    document.body.innerHTML = '<button data-tutorial="tab-history">x</button>';
    openTour();
    walkTo("History");
    expect(ring()).toBeTruthy();
    expect(holes()).toBe(1);
  });

  it("rings both of them when a section names two", () => {
    // Adding to the graph has two routes — the + buttons and the add bar — and
    // showing one at a time would make them look like alternatives to choose
    // between rather than the same thing twice.
    document.body.innerHTML =
      '<div data-tutorial="graph-add">x</div><div data-tutorial="add-bar">y</div>';
    openTour();
    walkTo("Adding to the graph");
    expect(holes()).toBe(2);
  });

  it("cuts a hole for a target that is missing, rather than ringing nothing", () => {
    // Only one of the two is on screen here; the section still points at what
    // it can find.
    document.body.innerHTML = '<div data-tutorial="graph-add">x</div>';
    openTour();
    walkTo("Adding to the graph");
    expect(holes()).toBe(1);
  });

  it("takes the spotlight away as soon as the reader uses the app", () => {
    // Otherwise pressing the ringed button — Start Workflow, say — leaves what
    // it did behind a grey sheet, and the ring goes on floating over whatever
    // the reader opens on top of it.
    document.body.innerHTML =
      '<button data-tutorial="tab-history">x</button><div id="app">app</div>';
    openTour();
    walkTo("History");
    expect(ring()).toBeTruthy();

    fireEvent.pointerDown(document.getElementById("app"));
    expect(ring()).toBeNull();
  });

  it("keeps the tour's own controls from dropping the spotlight", () => {
    document.body.innerHTML = '<button data-tutorial="tab-clusters">x</button>';
    openTour();
    walkTo("Coherence clusters");
    fireEvent.pointerDown(screen.getByText("← Back"));
    expect(ring()).toBeTruthy();
  });

  it("drops it for the keyboard too", () => {
    // Enter on a focused button fires no pointer event, and driving the app
    // from the keyboard is using it just as much.
    document.body.innerHTML =
      '<button data-tutorial="tab-history">x</button>' +
      '<button id="app-button">app</button>';
    openTour();
    walkTo("History");

    document.getElementById("app-button").focus();
    fireEvent.keyDown(document.getElementById("app-button"), { key: "Enter" });
    expect(ring()).toBeNull();
  });

  it("arms the spotlight again for the next section", () => {
    document.body.innerHTML =
      '<button data-tutorial="tab-history">x</button>' +
      '<button data-tutorial="tab-clusters">y</button>' +
      '<div id="app">app</div>';
    openTour();
    walkTo("History");
    fireEvent.pointerDown(document.getElementById("app"));
    expect(ring()).toBeNull();

    walkTo("Coherence clusters");
    expect(ring()).toBeTruthy();
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
      menu: false,
      addBar: false,
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
      [{ chrome: false, text: false, menu: false, addBar: false }],
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
        (r) => r.argumentId !== "arg-sample-3",
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
