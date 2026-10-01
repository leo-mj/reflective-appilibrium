// @vitest-environment jsdom
//
// The Simulate tab plays a result on the graph; the chart has to say which
// step is on screen, or it reads as the finished run while the graph is still
// part-way through it.
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { SimulateScoresChart } from "./SimulateScoresChart.jsx";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});
afterEach(cleanup);

const score = (z) => ({ z, account: z, systematicity: z, faithfulness: z });
// Step 0 has no scores, as rethon's first commitments have no theory yet.
const SCORES = [null, score(0.5), score(0.6), score(0.7), score(0.8)];

const marker = (container) =>
  container.querySelector('line[stroke-dasharray="3,2"]');

describe("SimulateScoresChart", () => {
  it("marks the step on screen, and dims the points still to come", () => {
    const { container } = render(<SimulateScoresChart scores={SCORES} current={2} />);
    expect(marker(container)).not.toBeNull();
    const dimmed = [...container.querySelectorAll("circle")].filter(
      (c) => c.getAttribute("opacity") === "0.35",
    );
    // Steps 3 and 4, for each of the four series.
    expect(dimmed).toHaveLength(8);
  });

  it("draws no marker at step 0, which has no place on the axis", () => {
    const { container } = render(<SimulateScoresChart scores={SCORES} current={0} />);
    expect(marker(container)).toBeNull();
  });

  it("draws no marker when not asked to follow a step", () => {
    const { container } = render(<SimulateScoresChart scores={SCORES} />);
    expect(marker(container)).toBeNull();
  });
});
