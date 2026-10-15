// @vitest-environment jsdom
//
// This tab was the one assist phase whose auto-fetch carried no guard at all:
// every other phase checks `suggestionsDisabled` before firing on arrival, and
// TheorySuggestTab adds a gate of its own on top. Arriving here in a build that
// cannot serve a suggestion therefore asked anyway, on arrival rather than on a
// press anyone could decline. These pin the guard and the keyless notice.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act, fireEvent, screen } from "@testing-library/react";

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

// The keyless notice gates itself on the key store and LLM_ENABLED, neither of
// which this tab knows about — so it is tested where those can be controlled,
// in GraphPanel.keyless.test.jsx, rather than mocked twice.

// ─── Arguments that fail the checker ─────────────────────────────────────────

describe("an argument that failed the checker", () => {
  const el = (id, type, text) => ({
    id,
    type,
    text,
    status: "active",
    confidence: 0.67,
    origin: "user",
    addedRound: 1,
  });
  const J1 = el("J1", "judgment", "A judgment");
  const P1 = el("P1", "principle", "A principle");
  const T1 = el("T1", "theory", "A theory");
  const state = () => ({ ...aState(), elements: [J1, P1, T1] });
  const FAILURE = {
    code: "invalid",
    reason: "Not formally valid: the premises do not entail the conclusion.",
  };

  async function detectWith(response, props = {}) {
    detectArguments.mockResolvedValueOnce({
      model: "test-model",
      lookup: {},
      dropped_count: 0,
      ...response,
    });
    await act(async () => {
      render(
        <DetectArgumentsTab state={state()} autoFetch {...props} />,
      );
    });
  }

  it("is shown with the reason, and a passing one without", async () => {
    await detectWith({
      translated_arguments: [
        [P1, J1],
        [T1, J1],
      ],
      argument_postulates: [["A bridge."], []],
      argument_failures: [null, FAILURE],
    });
    const cards = document.querySelectorAll('[role="note"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toBe(
      `Failed the argument checker: ${FAILURE.reason}`,
    );
    expect(document.body.textContent).toContain(
      "1 of 2 failed the argument checker",
    );
    expect(document.body.textContent).toContain("Valid given: A bridge.");
  });

  it("records the failure in the relation it becomes", async () => {
    const onAddRelation = vi.fn();
    await detectWith(
      {
        translated_arguments: [[T1, J1]],
        argument_postulates: [[]],
        argument_failures: [FAILURE],
      },
      { onAddRelation },
    );
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAddRelation).toHaveBeenCalledTimes(1);
    expect(onAddRelation.mock.calls[0][0]).toMatchObject({
      from: "T1",
      to: "J1",
      type: "entails",
      explanation: `Failed the argument checker: ${FAILURE.reason}`,
    });
  });

  it("draws no link from a circular argument's conclusion to itself", async () => {
    const onAddRelation = vi.fn();
    await detectWith(
      {
        translated_arguments: [[P1, J1, J1]],
        argument_postulates: [[]],
        argument_failures: [
          { code: "circular", reason: "Circular: the conclusion is among its own premises." },
        ],
      },
      { onAddRelation },
    );
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAddRelation.mock.calls.map(([r]) => [r.from, r.to, r.type])).toEqual([
      ["P1", "J1", "entails"],
    ]);
  });

  it("says how many proposals could not be shown at all", async () => {
    await detectWith({
      translated_arguments: [],
      argument_postulates: [],
      argument_failures: [],
      dropped_count: 2,
    });
    expect(document.body.textContent).toContain("2 proposals could not be shown");
  });
});
