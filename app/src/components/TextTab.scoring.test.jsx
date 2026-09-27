// @vitest-environment jsdom
//
// Withdrawal scores are asked for whenever the scored elements change. History
// opens at round 0, where there are none, and the server refuses an empty
// element list with a 422 — so an empty state must not ask at all.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  BACKEND_ENABLED: true,
}));
const client = vi.hoisted(() => ({
  scoreChanges: vi.fn(() => Promise.resolve(null)),
  scorePerRound: vi.fn(() => Promise.resolve({ round_scores: [] })),
}));
vi.mock("../utils/simulateRethonClient.js", () => client);

import { TextTab } from "./TextTab.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const stateWith = (elements) => ({
  topic: "t",
  phase: 1,
  round: elements.length ? 1 : 0,
  elements,
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
});

describe("withdrawal scores", () => {
  it("are not asked for when there are no elements", () => {
    render(<TextTab state={stateWith([])} />);
    expect(client.scoreChanges).not.toHaveBeenCalled();
  });

  it("are asked for once there is an element", () => {
    const j1 = {
      id: "J1",
      type: "judgment",
      status: "active",
      confidence: 0.8,
      origin: "user",
      text: "Lying is wrong.",
      addedRound: 1,
    };
    render(<TextTab state={stateWith([j1])} />);
    expect(client.scoreChanges).toHaveBeenCalledOnce();
  });
});
