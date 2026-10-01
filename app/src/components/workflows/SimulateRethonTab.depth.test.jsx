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
}));
vi.mock("../graphs_shared/SimulateScoresChart.jsx", () => ({
  SimulateScoresChart: () => null,
}));
const capabilities = vi.hoisted(() => ({ maxDepth: 0 }));
vi.mock("../../hooks/useBackendCapabilities.js", () => ({
  useBackendCapabilities: () => ({
    loaded: true,
    reachable: true,
    maxElements: 0,
    deployment: capabilities.maxDepth ? "hosted" : "local",
    maxDepth: capabilities.maxDepth,
  }),
}));

import { SimulateRethonTab } from "./SimulateRethonTab.jsx";
import { simulateRethon } from "../../utils/simulateRethonClient.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capabilities.maxDepth = 0;
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
