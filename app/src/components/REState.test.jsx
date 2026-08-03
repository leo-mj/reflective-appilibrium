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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = (state = SAMPLE_STATE) =>
  render(
    <REState initialState={state} isSample onHome={() => {}} onReady={() => {}} />,
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
