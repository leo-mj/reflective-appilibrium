// @vitest-environment jsdom
//
// What a visitor sees on arrival. The app used to open on the Assist panel,
// whose controls are gated on a backend — so in a demo build every visitor
// landed on a screen of dead buttons with no explanation.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import REState from "./REState.jsx";
import { SAMPLE_STATE, makeQuestionnaireState } from "../state.js";

beforeEach(() => {
  const NoopObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.stubGlobal("ResizeObserver", NoopObserver);
  vi.stubGlobal("IntersectionObserver", NoopObserver);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  // jsdom has no scrolling to do, and does not implement the call the tour's
  // Back and Next make.
  Element.prototype.scrollTo = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = (state = SAMPLE_STATE) =>
  render(
    <REState
      initialState={state}
      isSample
      onHome={() => {}}
      onReady={() => {}}
    />,
  );

/** The graph's own add-buttons overlay, present wherever the graph is drawn. */
const graphShown = () => screen.queryByLabelText("Add argument") !== null;
/**
 * The Text/Graph/Focus side-panel toggle, which the header renders only on an
 * assist or simulate tab — so its absence means we are on an analyze tab.
 */
const onAssistTab = () => screen.queryByText("Focus") !== null;

describe("the view a visitor lands on", () => {
  it("is the graph, which works without a backend", () => {
    open();
    expect(graphShown()).toBe(true);
    expect(onAssistTab()).toBe(false);
  });

  it("is not the elicit panel", () => {
    open();
    expect(screen.queryByText(/Elicit Judgments/)).toBeNull();
  });

  it("shows the text panel's search without a trip to the menu", () => {
    const { container } = open();
    expect(container.querySelector('input[type="search"]')).toBeTruthy();
  });
});

describe("the graph's full-screen toggle", () => {
  // It replaces a "Hide text" entry that sat in the burger menu, which is not
  // where anyone squinting at a half-width graph would look — and was also the
  // only way back once the text was gone.
  const textPanelShown = (container) =>
    container.querySelector('input[type="search"]') !== null;

  it("folds the text panel away and brings it back", () => {
    const { container } = open();
    expect(textPanelShown(container)).toBe(true);

    fireEvent.click(screen.getByLabelText("Full screen"));
    expect(textPanelShown(container)).toBe(false);

    // The way out has to be on the graph too, or full screen is a trap.
    fireEvent.click(screen.getByLabelText("Exit full screen"));
    expect(textPanelShown(container)).toBe(true);
  });

  it("stays away when narrow, where the text is a tab of its own", () => {
    const { innerWidth } = window;
    window.innerWidth = 420;
    try {
      open();
      expect(screen.queryByLabelText(/full screen/i)).toBeNull();
    } finally {
      window.innerWidth = innerWidth;
    }
  });

  it("also folds the assist panel away from the graph beside it", async () => {
    open();
    // Assist mode opens with the graph as its side panel, at half width. The
    // workflow panel it shares the row with is lazily imported.
    fireEvent.click(screen.getByText("Assist"));
    expect(onAssistTab()).toBe(true);
    await screen.findByText(/Elicit Judgments/);

    fireEvent.click(screen.getByLabelText("Full screen"));
    expect(screen.queryByText(/Elicit Judgments/)).toBeNull();
    expect(graphShown()).toBe(true);
    // Graph stays the lit choice in the header's Text/Graph/Focus switch, so
    // there are two ways back rather than a state nothing accounts for.
    expect(screen.getByText("Graph").style.background).not.toBe("transparent");

    fireEvent.click(screen.getByLabelText("Exit full screen"));
    await screen.findByText(/Elicit Judgments/);
  });
});

describe("the guided tour", () => {
  // The tour lives here rather than in the header because the wide one is not
  // a walk round the header at all: it reads the demo graph, so it needs the
  // selection and the framing that only this component holds.
  const tourShown = () => screen.queryByLabelText("Guided tour") !== null;
  /** The meta-tab buttons, which are the tab bar the tour hides at first. */
  const tabBarShown = () => screen.queryByText("Analyze") !== null;

  afterEach(() => sessionStorage.removeItem("startTour"));

  it("opens on the demo the home page loaded for it", () => {
    // The home page's Tutorial button sets this flag and then loads the sample,
    // so the tour opens on the state it is about to describe.
    sessionStorage.setItem("startTour", "1");
    open();
    expect(tourShown()).toBe(true);
    expect(screen.getByText("Reflective equilibrium")).toBeTruthy();
  });

  it("holds the tab bar back until the tour introduces it, and the graph stays up", () => {
    sessionStorage.setItem("startTour", "1");
    open();
    expect(tabBarShown()).toBe(false);
    // The opening chapters are read against the graph, so it had better be there.
    expect(graphShown()).toBe(true);

    fireEvent.click(screen.getByText("Next ↓"));
    fireEvent.click(screen.getByText("Next ↓"));
    expect(tabBarShown()).toBe(false);
  });

  it("puts the tab bar back on the way out", () => {
    sessionStorage.setItem("startTour", "1");
    open();
    fireEvent.click(screen.getByText("Close tour"));
    expect(tourShown()).toBe(false);
    expect(tabBarShown()).toBe(true);
  });

  it("can be replayed from the header's ? button", () => {
    open();
    expect(tourShown()).toBe(false);
    fireEvent.click(screen.getByLabelText("Start the step-by-step tour"));
    expect(tourShown()).toBe(true);
  });

  /** Presses Next until the tour is reading the section matching `title`. */
  const walkTourTo = (title) => {
    for (let i = 0; i < 40; i++) {
      const current = document.querySelector('[aria-current="step"]');
      if (title.test(current?.textContent ?? "")) return;
      const button = screen.queryByText("Next ↓");
      if (!button) break;
      fireEvent.click(button);
    }
    throw new Error(`the tour never reached ${title}`);
  };

  it("opens the ☰ menu for the sections that walk it, and shuts it after", () => {
    // Those sections ring entries that are not in the DOM until the menu is
    // open, so the tour drives the header's own menu as it goes.
    sessionStorage.setItem("startTour", "1");
    open();
    const filesEntry = () =>
      document.querySelector('[data-tutorial="menu-files"]');
    expect(filesEntry()).toBeNull();

    walkTourTo(/Saving your progress/);
    expect(filesEntry()).not.toBeNull();

    fireEvent.click(screen.getByText("Close tour"));
    expect(filesEntry()).toBeNull();
  });

  it("brings the text panel back for the section that points at it", () => {
    // It goes away with the rest of the chrome while the tour is reading the
    // graph, and comes back on its own for the section saying you are not
    // limited to the graph — the tab bar stays away for that one.
    sessionStorage.setItem("startTour", "1");
    open();
    const textPanel = () =>
      document.querySelector('[data-tutorial="text-panel"]');
    expect(textPanel()).toBeNull();

    walkTourTo(/The text panel/);
    expect(textPanel()).not.toBeNull();
    expect(tabBarShown()).toBe(false);
  });

  it("points at both ways of adding when it gets to making a position", () => {
    // The two targets that are neither in the header nor in its menu: the
    // graph's own overlay, and the add bar — which is hidden with the rest of
    // the chrome until this section asks for it back.
    sessionStorage.setItem("startTour", "1");
    open();
    const addBar = () => document.querySelector('[data-tutorial="add-bar"]');
    expect(addBar()).toBeNull();

    walkTourTo(/Adding to the graph/);
    expect(
      document.querySelector('[data-tutorial="graph-add"]'),
    ).not.toBeNull();
    expect(addBar()).not.toBeNull();
  });
});

describe("questionnaire mode", () => {
  it("still opens on its own tab, which is the whole point of that mode", () => {
    const spec = {
      id: "test",
      name: "Test",
      card: { title: "T", description: "d", buttonLabel: "b" },
      suggestions: [],
      participantArguments: [],
      furtherArguments: [],
    };
    open(makeQuestionnaireState(spec));
    expect(onAssistTab()).toBe(true);
  });
});
