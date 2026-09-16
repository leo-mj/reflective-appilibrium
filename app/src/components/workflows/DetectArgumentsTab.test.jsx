// @vitest-environment jsdom
//
// This tab was the one assist phase whose auto-fetch carried no guard at all:
// every other phase checks `suggestionsDisabled` before firing on arrival, and
// TheorySuggestTab adds a gate of its own on top. Arriving here in a build that
// cannot serve a suggestion therefore asked anyway, on arrival rather than on a
// press anyone could decline. These pin the guard and the keyless notice.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

vi.mock("../../utils/argumentsClient.js", () => ({
  detectArguments: vi.fn().mockResolvedValue({
    model: "test-model",
    arguments: [],
    translated_arguments: [],
    added_elements: [],
  }),
}));

import { DetectArgumentsTab } from "./DetectArgumentsTab.jsx";
import { detectArguments } from "../../utils/argumentsClient.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const aState = () => ({
  topic: "Obligations to future generations",
  round: 2,
  elements: [
    {
      id: "J1",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      text: "A judgment",
      addedRound: 1,
    },
  ],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
});

async function renderTab(props = {}) {
  await act(async () => {
    render(<DetectArgumentsTab state={aState()} {...props} />);
  });
}

describe("the auto-fetch guard", () => {
  it("asks for nothing until the button is pressed", async () => {
    await renderTab();
    expect(detectArguments).not.toHaveBeenCalled();
  });

  it("detects on arrival when the workflow says to", async () => {
    await renderTab({ autoFetch: true });
    expect(detectArguments).toHaveBeenCalled();
  });

  it("does not auto-fetch when suggestions are disabled", async () => {
    await renderTab({ autoFetch: true, suggestionsDisabled: true });
    expect(detectArguments).not.toHaveBeenCalled();
  });
});

describe("the keyless notice", () => {
  it("is absent when a key is configured", async () => {
    await renderTab();
    expect(screen.queryByText(/These are sample suggestions/)).toBeNull();
  });

  it("appears when the visitor has supplied no key", async () => {
    await renderTab({ keyMissing: true });
    expect(screen.getByText(/These are sample suggestions/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add a key/ })).toBeTruthy();
  });
});
