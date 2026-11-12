// @vitest-environment jsdom
//
// The search depth a server allows. A hosted one searches no deeper than 2 —
// depth 3 took the merged demo past its 60s limit, with every other visitor's
// simulation queued behind it — and says so in /api/health. Depth 1 finds too
// little to be worth offering, so there the tab searches at the limit and offers
// no choice, saying which depth it uses. Nothing it asks for can be refused.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("../../utils/simulateRethonClient.js", () => ({
  simulateRethon: vi.fn(() => new Promise(() => {})),
  quickScore: vi.fn(async () => null),
}));
vi.mock("../graphs_shared/SimulateScoresChart.jsx", () => ({
  SimulateScoresChart: () => null,
}));
const capabilities = vi.hoisted(() => ({
  maxDepth: 0,
  loaded: true,
  reachable: true,
}));
vi.mock("../../hooks/useBackendCapabilities.js", () => ({
  useBackendCapabilities: () => ({
    loaded: capabilities.loaded,
    reachable: capabilities.reachable,
    maxElements: 0,
    deployment: capabilities.maxDepth ? "hosted" : "local",
    maxDepth: capabilities.maxDepth,
  }),
}));

const wake = vi.hoisted(() => ({ phase: "ready" }));
vi.mock("../../utils/wakeBackend.js", () => ({
  useBackendWake: () => ({ phase: wake.phase, since: null, reason: "page" }),
  wakeBackend: () => undefined,
}));

import { SimulateRethonTab } from "./SimulateRethonTab.jsx";
import { simulateRethon } from "../../utils/simulateRethonClient.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capabilities.maxDepth = 0;
  capabilities.loaded = true;
  capabilities.reachable = true;
  wake.phase = "ready";
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
  elements: [
    element("J1", "judgment"),
    element("P2", "principle"),
    element("J3", "judgment"),
  ],
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

const depthOptions = () =>
  [...screen.getByRole("combobox").querySelectorAll("option")].map((o) =>
    Number(o.value),
  );
/** The depth argument of a simulate or step call. */
const depthSent = (mock) => mock.mock.calls[0][4];

describe("on a server with no depth limit", () => {
  it("offers every depth and starts at 3", () => {
    render(<SimulateRethonTab state={aState()} />);
    expect(depthOptions()).toEqual([1, 2, 3, 4]);
    fireEvent.click(screen.getByRole("button", { name: /equilibrate/i }));
    expect(depthSent(simulateRethon)).toBe(3);
  });
});

describe("on a server that searches to a depth of 2", () => {
  it("offers no choice, and says which depth it uses", () => {
    capabilities.maxDepth = 2;
    render(<SimulateRethonTab state={aState()} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Depth 2")).toBeTruthy();
  });

  it("asks for no deeper search than that", () => {
    capabilities.maxDepth = 2;
    render(<SimulateRethonTab state={aState()} />);
    fireEvent.click(screen.getByRole("button", { name: /equilibrate/i }));
    expect(depthSent(simulateRethon)).toBe(2);
  });
});

// Seen on the hosted site: the health check failed while the server was
// starting, the tab read that as "no limit", offered 1–4 starting at 3, and the
// server refused the run with a 422.
describe("before the server has said what it allows", () => {
  it("offers no depth and does not run while the health check is pending", () => {
    capabilities.loaded = false;
    capabilities.reachable = false;
    render(<SimulateRethonTab state={aState()} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    const run = screen.getByRole("button", { name: /equilibrate/i });
    expect(run.disabled).toBe(true);
    fireEvent.click(run);
    expect(simulateRethon).not.toHaveBeenCalled();
    expect(screen.getByText(/once the server is ready/i)).toBeTruthy();
  });

  it("offers no depth and does not run when the server could not be reached", () => {
    capabilities.reachable = false;
    render(<SimulateRethonTab state={aState()} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: /equilibrate/i }).disabled).toBe(
      true,
    );
    expect(screen.getByText(/server unreachable/i)).toBeTruthy();
  });
});

// The health check answering is not enough: the workers load rethon after it,
// and a run pressed then waited behind their start.
describe("while the server is up but its workers are still starting", () => {
  it("offers the depth but does not run until the wake-up is done", () => {
    wake.phase = "warming";
    const { rerender } = render(<SimulateRethonTab state={aState()} />);
    expect(depthOptions()).toEqual([1, 2, 3, 4]);
    const run = () => screen.getByRole("button", { name: /equilibrate/i });
    expect(run().disabled).toBe(true);
    expect(screen.getByText(/once the server is ready/i)).toBeTruthy();

    wake.phase = "ready";
    rerender(<SimulateRethonTab state={aState()} />);
    expect(run().disabled).toBe(false);
    expect(screen.queryByText(/once the server is ready/i)).toBeNull();
  });
});
