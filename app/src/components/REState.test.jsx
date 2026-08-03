// @vitest-environment jsdom
//
// What a visitor sees on arrival. The app used to open on the Assist panel,
// whose controls are gated on a backend — so in a demo build every visitor
// landed on a screen of dead buttons with no explanation.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

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
