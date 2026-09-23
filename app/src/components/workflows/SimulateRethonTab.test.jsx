// @vitest-environment jsdom
//
// The Stop button. A local backend puts no time limit on a simulation, so this
// is the only way to end one short of restarting the server — and aborting the
// fetch is what tells the server to kill the worker (backend
// tests/test_simulation_stop.py). These pin the browser half: that the request
// really is aborted, that stopping leaves the tab where it was, and that a
// request settling after it was stopped cannot touch the run that followed.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";

vi.mock("../../utils/simulateRethonClient.js", () => ({
  simulateRethon: vi.fn(),
  simulateRethonStep: vi.fn(),
}));
vi.mock("../graphs_shared/SimulateScoresChart.jsx", () => ({
  SimulateScoresChart: () => null,
}));

import { SimulateRethonTab } from "./SimulateRethonTab.jsx";
import { simulateRethon, simulateRethonStep } from "../../utils/simulateRethonClient.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const element = (id, type) => ({
  id,
  type,
  status: "active",
  confidence: 0.7,
  text: `element ${id}`,
  addedRound: 1,
});

const aState = () => ({
  topic: "t",
  round: 1,
  elements: [element("J1", "judgment"), element("P2", "principle"), element("J3", "judgment")],
  relations: ["P2", "J3"].map((from) => ({
    from,
    to: "J1",
    type: "jointly_entails",
    explanation: "",
    addedRound: 1,
    argumentId: "a1",
  })),
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
});

const aResult = (steps, finished = false) => ({
  translated_arguments: [],
  translated_re_state: {
    finished,
    evolution: Array.from({ length: steps }, () => [element("J1", "judgment")]),
    step_types: Array.from({ length: steps }, (_, i) => (i % 2 ? "theory" : "commitments")),
    alternatives: [],
    scores: Array.from({ length: steps }, () => null),
  },
});

/**
 * A request that settles only when the test says so, and rejects the way
 * `fetch` does when its signal is aborted.
 */
function controlledRequest() {
  const handle = {};
  const impl = (...args) => {
    const { signal } = args[args.length - 1];
    handle.signal = signal;
    return new Promise((resolve, reject) => {
      handle.resolve = resolve;
      handle.reject = reject;
      signal.addEventListener("abort", () =>
        reject(new DOMException("The operation was aborted.", "AbortError")),
      );
    });
  };
  return { handle, impl };
}

const press = async (name) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("stopping a simulation", () => {
  it("offers Stop only while a request is running", async () => {
    const { impl } = controlledRequest();
    simulateRethon.mockImplementation(impl);
    render(<SimulateRethonTab state={aState()} />);

    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
    await press(/equilibrate/i);
    expect(screen.getByRole("button", { name: /stop/i })).toBeTruthy();
  });

  it("aborts the request and says so, without an error", async () => {
    const { handle, impl } = controlledRequest();
    simulateRethon.mockImplementation(impl);
    render(<SimulateRethonTab state={aState()} />);

    await press(/equilibrate/i);
    await press(/stop/i);

    expect(handle.signal.aborted).toBe(true);
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
    expect(screen.getByRole("button", { name: /equilibrate/i }).disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toMatch(/stopped/i);
    expect(screen.queryByText(/aborted/i)).toBeNull();
  });

  it("keeps the steps already accepted", async () => {
    simulateRethonStep.mockResolvedValue(aResult(2));
    render(<SimulateRethonTab state={aState()} />);
    await press(/^→\s*step$/i);
    await press(/accept/i);
    expect(screen.getByRole("button", { name: /next step/i })).toBeTruthy();

    const { impl } = controlledRequest();
    simulateRethon.mockImplementation(impl);
    await press(/equilibrate/i);
    await press(/stop/i);

    // A run from accepted steps used to discard them before it began.
    expect(screen.getByRole("button", { name: /next step/i })).toBeTruthy();
    expect(screen.getByText(/1 step\b/)).toBeTruthy();
  });

  it("aborts the request when the tab is left", async () => {
    const { handle, impl } = controlledRequest();
    simulateRethon.mockImplementation(impl);
    const { unmount } = render(<SimulateRethonTab state={aState()} />);

    await press(/equilibrate/i);
    unmount();

    expect(handle.signal.aborted).toBe(true);
  });

  it("does not let a stopped request touch the run after it", async () => {
    const first = controlledRequest();
    const second = controlledRequest();
    simulateRethon.mockImplementationOnce(first.impl).mockImplementationOnce(second.impl);
    render(<SimulateRethonTab state={aState()} />);

    await press(/equilibrate/i);
    await press(/stop/i);
    await press(/equilibrate/i);

    // The first one's rejection lands now, while the second is running.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /stop/i })).toBeTruthy();
    expect(screen.getByText(/equilibrating/i)).toBeTruthy();

    // And a late success from it would not be applied either.
    await act(async () => {
      first.handle.resolve(aResult(8, true));
    });
    expect(screen.queryByText(/equilibrium reached/i)).toBeNull();
  });
});
