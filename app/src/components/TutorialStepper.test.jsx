// @vitest-environment jsdom
//
// The two layouts are different enough apps to need different tours, and this
// component is the phone's: it introduces the graph, then opens the ☰ menu and
// walks its sections, which at this width is where everything else lives. The
// wide tour is `tour/GuidedTour.jsx`, covered in its own suite.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { useState } from "react";

import { TutorialStepper, TOUR_Z } from "./TutorialStepper.jsx";

beforeEach(() => {
  // The stepper measures its target one frame after each step change.
  vi.stubGlobal("requestAnimationFrame", (cb) => {
    cb();
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const openTour = (props = {}) =>
  render(
    <TutorialStepper
      active
      onClose={() => {}}
      onSetTab={() => {}}
      hideNonEntailsRels={false}
      {...props}
    />,
  );

const nextButton = () => screen.queryByText("Next →");
const advance = () =>
  act(() => {
    fireEvent.click(nextButton());
  });

/** Every card's title, in order, from the first step to the last. */
const walk = (onEachStep = () => {}) => {
  const titles = [];
  while (true) {
    // The title is the card's first line; the body follows it.
    titles.push(document.body.textContent);
    onEachStep(titles.length - 1);
    if (!nextButton()) return titles.join("\n");
    advance();
  }
};

/** Clicks through until the card shows `title`, then reports if it has a ring. */
const ringOnStep = (title) => {
  while (!document.body.textContent.includes(title)) {
    if (!nextButton()) throw new Error(`never reached the "${title}" step`);
    advance();
  }
  return document.querySelector(`[style*="z-index: ${TOUR_Z.ring}"]`) !== null;
};

describe("the narrow tour", () => {
  it("opens on the welcome card, then the graph, then the menu", () => {
    openTour();
    const order = [];
    walk(() => {
      const heading = document.body.textContent;
      if (heading.includes("Welcome to Reflective")) order.push("welcome");
      else if (heading.includes("Your position, as a graph"))
        order.push("graph");
      else if (heading.includes("Everything else is in here"))
        order.push("menu");
    });
    expect(order).toEqual(["welcome", "graph", "menu"]);
  });

  it("opens the menu for the steps that walk it, and shuts it again", () => {
    const onSetMenuOpen = vi.fn();
    openTour({ onSetMenuOpen });

    // The first three steps are about the screen behind the menu.
    expect(onSetMenuOpen).toHaveBeenLastCalledWith(false);
    advance();
    advance();
    advance();
    expect(onSetMenuOpen).toHaveBeenLastCalledWith(true);

    // …and the last card is a farewell, not a menu section.
    while (nextButton()) advance();
    expect(onSetMenuOpen).toHaveBeenLastCalledWith(false);
  });

  it("shuts the menu it opened when the tour is skipped", () => {
    const onSetMenuOpen = vi.fn();
    // Closing for real, so the stepper unmounts its steps rather than resetting
    // to step 0 — otherwise the step-0 effect would close the menu anyway and
    // this would pass whether or not the close handler does its job.
    function Host() {
      const [active, setActive] = useState(true);
      return (
        <TutorialStepper
          active={active}
          onClose={() => setActive(false)}
          onSetTab={() => {}}
          onSetMenuOpen={onSetMenuOpen}
          hideNonEntailsRels={false}
        />
      );
    }
    render(<Host />);
    advance();
    advance();
    advance();
    expect(onSetMenuOpen).toHaveBeenLastCalledWith(true);

    onSetMenuOpen.mockClear();
    act(() => {
      fireEvent.click(screen.getByText("Close tour"));
    });
    expect(onSetMenuOpen).toHaveBeenCalledWith(false);
  });

  it("rings each section of the menu in turn", () => {
    document.body.innerHTML = `
      <div data-tutorial="menu-assist"></div>
      <div data-tutorial="menu-analyze"></div>
      <div data-tutorial="menu-settings"></div>
      <div data-tutorial="menu-files"></div>
      <button data-tutorial="menu-undo"></button>`;
    openTour();
    for (const title of [
      "Assist — the RE cycle",
      "Analyze — see where you stand",
      "Settings",
      "Import and export",
      "Undo",
    ]) {
      expect(ringOnStep(title)).toBe(true);
    }
  });

  it("never names a control the wide layout alone renders", () => {
    openTour();
    const all = walk();
    // These are the wide header's own labels; on a phone they name nothing.
    expect(all).not.toContain("? button");
    expect(all).not.toContain("Ctrl");
    expect(all).not.toContain("The Assist tab");
  });

  it("draws its ring above the menu it lifts over the dim", () => {
    // Otherwise the menu, raised so it is readable, paints over the ring that
    // is supposed to be pointing at it.
    expect(TOUR_Z.ring).toBeGreaterThan(TOUR_Z.menu);
    expect(TOUR_Z.menu).toBeGreaterThan(TOUR_Z.dim);
    expect(TOUR_Z.card).toBeGreaterThan(TOUR_Z.ring);
  });
});
