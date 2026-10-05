// @vitest-environment jsdom
//
// The Stop button. A local backend puts no time limit on a simulation, so this
// is the only way to end one short of restarting the server — and aborting the
// fetch is what tells the server to kill the worker (backend
// tests/test_simulation_stop.py). These pin the browser half: that the request
// really is aborted, that stopping leaves the tab where it was, and that a
// request settling after it was stopped cannot touch the run that followed.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent, within } from "@testing-library/react";

vi.mock("../../utils/simulateRethonClient.js", () => ({
  simulateRethon: vi.fn(),
}));
vi.mock("../graphs_shared/SimulateScoresChart.jsx", () => ({
  SimulateScoresChart: () => null,
}));

// A server that has answered and sets no depth limit: the tab runs only once
// one has (SimulateRethonTab.depth.test.jsx), and these tests are about running.
vi.mock("../../hooks/useBackendCapabilities.js", () => ({
  useBackendCapabilities: () => ({
    loaded: true,
    reachable: true,
    maxElements: 0,
    deployment: "local",
    maxDepth: 0,
  }),
}));

import { SimulateRethonTab } from "./SimulateRethonTab.jsx";
import { BASE_INTERVAL_MS } from "../../hooks/usePlayback.js";
import { simulateRethon } from "../../utils/simulateRethonClient.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  delete window.matchMedia;
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

/**
 * A run over aState() that settles by withdrawing J3: the held theory P2
 * accounts for J1 and not for J3.
 */
const settles = () => ({
  translated_arguments: [],
  translated_re_state: {
    finished: true,
    evolution: [
      [element("J1", "judgment"), element("P2", "principle"), element("J3", "judgment")],
      [element("P2", "principle")],
      [element("J1", "judgment"), element("P2", "principle")],
      [element("P2", "principle")],
    ],
    step_types: ["commitments", "theory", "commitments", "theory"],
    alternatives: [],
    scores: [null, ...Array.from({ length: 3 }, () => ({ z: 0.5, account: 0.5, systematicity: 0.5, faithfulness: 0.5 }))],
  },
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

describe("what a simulation needs", () => {
  it("asks for a principle or background theory, its theory being made of them", () => {
    // The server refuses a process with neither (rethon_theory.py); the tab
    // says so before the press rather than after it.
    const judgmentsOnly = {
      ...aState(),
      elements: aState().elements.map((e) => ({ ...e, type: "judgment" })),
    };
    render(<SimulateRethonTab state={judgmentsOnly} />);
    expect(screen.getByRole("button", { name: /equilibrate/i }).disabled).toBe(true);
    expect(screen.getByText(/principle or background theory/i)).toBeTruthy();
    cleanup();

    render(<SimulateRethonTab state={aState()} />);
    expect(screen.getByRole("button", { name: /equilibrate/i }).disabled).toBe(false);
  });
});

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

  it("keeps the previous result on screen", async () => {
    simulateRethon.mockResolvedValueOnce(settles());
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    const { impl } = controlledRequest();
    simulateRethon.mockImplementation(impl);
    await press(/equilibrate/i);
    await press(/stop/i);

    expect(screen.getByText(/withdrawn · 1/i)).toBeTruthy();
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

describe("a result", () => {
  it("says what accepting would change, and no more", async () => {
    simulateRethon.mockResolvedValue(settles());
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    expect(screen.getByText(/withdrawn · 1/i)).toBeTruthy();
    expect(screen.getByText("element J3")).toBeTruthy();
    // Kept elements are not listed: the reader decides on what changes.
    expect(screen.queryByText("element J1")).toBeNull();
    expect(screen.getByText(/everything else stays/i)).toBeTruthy();
  });

  it("applies exactly what it listed", async () => {
    simulateRethon.mockResolvedValue(settles());
    const onApply = vi.fn();
    render(<SimulateRethonTab state={aState()} onApplyRethonEquilibrium={onApply} />);
    await press(/equilibrate/i);
    await press(/^accept$/i);

    expect(onApply).toHaveBeenCalledWith({
      withdraw: ["J3"],
      takeUp: [],
      reject: [],
      // And how it was run, for the log.
      run: {
        depth: 3,
        weights: { account: 0.35, systematicity: 0.55, faithfulness: 0.1 },
        from: 0.5,
        to: 0.5,
      },
    });
    expect(screen.getByText(/applied to your position/i)).toBeTruthy();
  });

  it.each([
    ["accept", /applied to your position/i],
    ["reject", /result discarded/i],
  ])("is cleared once the reader decides — %s", async (decide, said) => {
    // Kept after a decision, its steps went on offering a Play that moved
    // nothing on the graph.
    simulateRethon.mockResolvedValue(settles());
    const onPreview = vi.fn();
    render(<SimulateRethonTab state={aState()} onSetEquilibriumPreview={onPreview} />);
    await press(/equilibrate/i);
    await press(new RegExp(`^${decide}$`, "i"));

    expect(screen.getByRole("status").textContent).toMatch(said);
    expect(screen.queryByRole("list", { name: /steps/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /play|replay|pause/i })).toBeNull();
    expect(screen.queryByText(/if you accept/i)).toBeNull();
    expect(onPreview.mock.calls.at(-1)[0]).toBeNull();
  });

  it("offers nothing to accept when nothing would change", async () => {
    const still = settles();
    still.translated_re_state.evolution[2].push(element("J3", "judgment"));
    simulateRethon.mockResolvedValue(still);
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    expect(screen.getByText(/already in equilibrium/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^accept$/i })).toBeNull();
    // Only a way to put the result away.
    await press(/^dismiss$/i);
    expect(screen.queryByText(/if you accept/i)).toBeNull();
  });

  it("keeps the decision in a bar of its own, saying what accepting does", async () => {
    // Inside the list, Accept scrolled away with the steps.
    simulateRethon.mockResolvedValue(settles());
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    const bar = screen.getByRole("region", { name: /decide on the result/i });
    expect(bar.textContent).toMatch(/accepting would withdraw 1 — as one step/i);
    expect(within(bar).getByRole("button", { name: /^accept$/i })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: /^reject$/i })).toBeTruthy();
  });

  it("lists each step as what it changed", async () => {
    simulateRethon.mockResolvedValue(settles());
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    const rows = screen.getAllByRole("listitem").map((r) => r.textContent);
    expect(rows[0]).toMatch(/your current commitments/i);
    expect(rows[1]).toMatch(/the theory you hold/i);
    expect(rows[2]).toMatch(/−J3/);
    expect(rows[3]).toMatch(/no change/i);
  });
});

describe("playing a result on the graph", () => {
  const lastPreview = (mock) => mock.mock.calls.findLast(([p]) => p)?.[0];

  it("starts where the reader stands and plays through to the equilibrium", async () => {
    vi.useFakeTimers();
    simulateRethon.mockResolvedValue(settles());
    const onPreview = vi.fn();
    render(<SimulateRethonTab state={aState()} onSetEquilibriumPreview={onPreview} />);
    await press(/equilibrate/i);

    expect(screen.getByText("Step 0 of 3")).toBeTruthy();
    expect([...lastPreview(onPreview).withdrawn]).toEqual([]);

    // Each step is scheduled once the one before it has rendered.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => vi.advanceTimersByTime(BASE_INTERVAL_MS));
    }
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: /replay/i })).toBeTruthy();
    expect([...lastPreview(onPreview).withdrawn]).toEqual(["J3"]);
  });

  it("plays at the speed picked, History's speeds", async () => {
    vi.useFakeTimers();
    simulateRethon.mockResolvedValue(settles());
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);
    await press(/^4×$/);

    // A quarter of the shared time per step at 4×: three of those reach the end.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => vi.advanceTimersByTime(BASE_INTERVAL_MS / 4));
    }
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^4×$/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows a step on the graph when it is picked", async () => {
    simulateRethon.mockResolvedValue(settles());
    const onPreview = vi.fn();
    render(<SimulateRethonTab state={aState()} onSetEquilibriumPreview={onPreview} />);
    await press(/equilibrate/i);
    await press(/show step 2 on the graph/i);

    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    expect([...lastPreview(onPreview).withdrawn]).toEqual(["J3"]);
    // And the log box over the graph, one entry a step, at the step picked.
    const { log, step } = lastPreview(onPreview);
    expect(step).toBe(2);
    expect(log.map((l) => l.changes)).toEqual([
      "Starts from your current commitments.",
      "Starts from the theory you hold.",
      "Drops J3.",
      "No change.",
    ]);
  });

  it("starts at the end for a reader who asks for less motion", async () => {
    window.matchMedia = () => ({ matches: true });
    simulateRethon.mockResolvedValue(settles());
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
  });

  it("clears the graph's preview once the result is accepted", async () => {
    simulateRethon.mockResolvedValue(settles());
    const onPreview = vi.fn();
    render(<SimulateRethonTab state={aState()} onSetEquilibriumPreview={onPreview} />);
    await press(/equilibrate/i);
    await press(/^accept$/i);

    expect(onPreview.mock.calls.at(-1)[0]).toBeNull();
  });
});

describe("a result that no longer fits the position", () => {
  it("stops offering Accept once the position changes under it", async () => {
    // The lists would be this position read against another's equilibrium.
    simulateRethon.mockResolvedValue(settles());
    const onApply = vi.fn();
    const { rerender } = render(
      <SimulateRethonTab state={aState()} onApplyRethonEquilibrium={onApply} />,
    );
    await press(/equilibrate/i);
    expect(screen.getByRole("button", { name: /^accept$/i })).toBeTruthy();

    const moved = aState();
    moved.elements.push(element("J4", "judgment"));
    rerender(<SimulateRethonTab state={moved} onApplyRethonEquilibrium={onApply} />);

    expect(screen.queryByRole("button", { name: /^accept$/i })).toBeNull();
    expect(screen.getByText(/your position has changed since this ran/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /run again/i })).toBeTruthy();
  });

  it("does not count a change of wording, which rethon never reads", async () => {
    simulateRethon.mockResolvedValue(settles());
    const { rerender } = render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    const reworded = aState();
    reworded.elements[0] = { ...reworded.elements[0], text: "reworded" };
    rerender(<SimulateRethonTab state={reworded} />);

    expect(screen.getByRole("button", { name: /^accept$/i })).toBeTruthy();
  });

  it("counts a change of weights, which the result was computed with", async () => {
    simulateRethon.mockResolvedValue(settles());
    const { rerender } = render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    rerender(
      <SimulateRethonTab
        state={aState()}
        weights={{ account: 0.6, systematicity: 0.3, faithfulness: 0.1 }}
      />,
    );
    expect(screen.queryByRole("button", { name: /^accept$/i })).toBeNull();
  });
});

describe("what the tab says around a result", () => {
  it("says what the tab is for before there is a result", () => {
    render(<SimulateRethonTab state={aState()} />);
    expect(screen.getByText(/hands your position to/i)).toBeTruthy();
  });

  it("gives the achievement before and after", async () => {
    const run = settles();
    run.translated_re_state.scores[1] = { ...run.translated_re_state.scores[1], z: 0.683 };
    run.translated_re_state.scores[3] = { ...run.translated_re_state.scores[3], z: 0.954 };
    simulateRethon.mockResolvedValue(run);
    render(<SimulateRethonTab state={aState()} />);
    await press(/equilibrate/i);

    const bar = screen.getByRole("region", { name: /decide on the result/i });
    expect(bar.textContent).toMatch(/achievement 0\.683 → 0\.954/i);
  });

  it("hands the graph the theory in force at the step shown", async () => {
    simulateRethon.mockResolvedValue(settles());
    const onPreview = vi.fn();
    render(<SimulateRethonTab state={aState()} onSetEquilibriumPreview={onPreview} />);
    await press(/equilibrate/i);
    await press(/show step 1 on the graph/i);

    const preview = onPreview.mock.calls.findLast(([p]) => p)[0];
    expect([...preview.theory]).toEqual(["P2"]);
    // And says what that ring means, beside the others.
    expect(screen.getByText(/in the theory/i)).toBeTruthy();
  });

  it("shows the weights beside the button they steer, and sets them there", async () => {
    const onWeightsChange = vi.fn();
    render(
      <SimulateRethonTab
        state={aState()}
        weightControl={{
          weights: { account: 0.35, systematicity: 0.55, faithfulness: 0.1 },
          weightsChanged: false,
          onWeightsChange,
          onResetWeights: vi.fn(),
        }}
      />,
    );
    const readout = screen.getByRole("button", { name: /A \.35 · S \.55 · F \.10/ });
    await act(async () => fireEvent.click(readout));
    expect(readout.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("the description", () => {
  it("links to rethon, in a tab of its own", () => {
    render(<SimulateRethonTab state={aState()} />);
    const link = screen.getByRole("link", { name: "rethon" });
    expect(link.getAttribute("href")).toBe("https://github.com/re-models/rethon");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toMatch(/noopener/);
  });
});
