// @vitest-environment jsdom
//
// A new process used to open on empty panels with nothing to say what comes
// first. The guide says it — judgments — in the tour's words, and goes as soon
// as there is an element.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { EmptyProcessGuide } from "./EmptyProcessGuide.jsx";
import { TextTab } from "./TextTab.jsx";

afterEach(cleanup);

const emptyState = (elements = []) => ({
  topic: "t",
  phase: 1,
  round: 1,
  elements,
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
});

const judgment = {
  id: "J1",
  type: "judgment",
  status: "active",
  confidence: 0.7,
  origin: "user",
  text: "Lying is wrong.",
  addedRound: 1,
};

describe("EmptyProcessGuide", () => {
  it("starts from judgments, and names where to add one at each width", () => {
    render(<EmptyProcessGuide isWide />);
    expect(document.body.textContent).toContain(
      "moral judgments you are fairly confident about",
    );
    expect(document.body.textContent).toContain("the bar at the bottom");
    cleanup();
    render(<EmptyProcessGuide isWide={false} />);
    expect(document.body.textContent).toContain("the + button");
  });

  // The tour runs on the demo, not on this process; the header's ? is the way
  // to it, and asks before leaving.
  it("does not offer the tour", () => {
    render(<EmptyProcessGuide isWide />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  // The demo build has no LLM: pointing at Assist there would send the reader
  // to a tab that cannot answer. Tests run as the demo (vite.config.js).
  it("does not mention Assist in a build without the LLM", () => {
    render(<EmptyProcessGuide isWide />);
    expect(document.body.textContent).not.toContain("Assist");
  });

  it("is one line when brief", () => {
    render(<EmptyProcessGuide brief isWide />);
    expect(document.body.textContent).toBe(
      "Your judgments, principles and theories appear here as you add them.",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the text panel of an empty process", () => {
  const guide = () => document.querySelector("[data-empty-guide]");

  it("shows the guide", () => {
    render(<TextTab state={emptyState()} isWide />);
    expect(guide()).not.toBeNull();
  });

  it("drops it once there is an element", () => {
    const { rerender } = render(<TextTab state={emptyState()} isWide />);
    rerender(<TextTab state={emptyState([judgment])} isWide />);
    expect(guide()).toBeNull();
  });

  // History's round 0 is empty too, but it is a projection of a process that
  // has elements, and the banner already says which round it is.
  it("does not show it in History's projection", () => {
    render(
      <TextTab
        state={emptyState()}
        isWide
        historyView={{ round: 0, maxRound: 5 }}
      />,
    );
    expect(guide()).toBeNull();
  });
});
