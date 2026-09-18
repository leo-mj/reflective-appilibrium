// @vitest-environment jsdom
//
// The server keeps nothing between turns, so the panel is the conversation's
// only home: each question has to carry every earlier one and its reply, and
// the panel has to stop at the length the server will accept rather than let
// the next question fail.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("../../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  LLM_ENABLED: true,
}));

const ask = vi.hoisted(() => vi.fn());
vi.mock("../../utils/conversationsClient.js", async (importOriginal) => ({
  ...(await importOriginal()),
  askInConversation: ask,
}));

import { ConversationPanel } from "./ConversationPanel.jsx";
import { MAX_EXCHANGES } from "../../utils/conversationsClient.js";

const state = { topic: "t", elements: [], relations: [] };
const suggestion = { text: "s" };

beforeEach(() => {
  ask.mockImplementation(async (_state, _suggestion, messages) => ({
    reply: `reply to ${messages.at(-1).content}`,
    model: "m",
  }));
});

afterEach(() => {
  cleanup();
  ask.mockReset();
});

const field = () => screen.getByPlaceholderText("Ask about this suggestion…");

async function askQuestion(text) {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.click(screen.getByText("Ask"));
  await waitFor(() => expect(screen.getByText(`reply to ${text}`)).toBeTruthy());
}

describe("ConversationPanel", () => {
  it("sends a follow-up with the whole conversation before it", async () => {
    render(<ConversationPanel state={state} suggestion={suggestion} />);
    await askQuestion("why?");
    await askQuestion("and then?");

    expect(ask).toHaveBeenCalledTimes(2);
    const [sentState, sentSuggestion, messages] = ask.mock.calls[1];
    expect(sentState).toBe(state);
    expect(sentSuggestion).toBe(suggestion);
    expect(messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: "user", content: "why?" },
      { role: "assistant", content: "reply to why?" },
      { role: "user", content: "and then?" },
    ]);
  });

  it("sends the state as it is when the question is asked", async () => {
    const { rerender } = render(
      <ConversationPanel state={state} suggestion={suggestion} />,
    );
    await askQuestion("why?");

    const later = { ...state, topic: "changed" };
    rerender(<ConversationPanel state={later} suggestion={suggestion} />);
    await askQuestion("and now?");

    expect(ask.mock.calls[1][0]).toBe(later);
  });

  it("drops a question that failed, so the next one is not sent after it", async () => {
    render(<ConversationPanel state={state} suggestion={suggestion} />);
    ask.mockRejectedValueOnce(new Error("Too many requests"));
    fireEvent.change(field(), { target: { value: "lost" } });
    fireEvent.click(screen.getByText("Ask"));
    await waitFor(() => expect(screen.getByText(/Too many requests/)).toBeTruthy());

    await askQuestion("again");
    expect(ask.mock.calls[1][2].map((m) => m.content)).toEqual(["again"]);
  });

  it("stops at the exchange limit the server enforces", async () => {
    render(<ConversationPanel state={state} suggestion={suggestion} />);
    for (let i = 0; i < MAX_EXCHANGES; i++) await askQuestion(`q${i}`);

    expect(screen.getByText(/reached its 20-question limit/)).toBeTruthy();
    expect(field().disabled).toBe(true);
    // The last question sent carried the most history the server accepts:
    // MAX_EXCHANGES - 1 exchanges plus itself (MAX_MESSAGES in conversations.py).
    expect(ask.mock.calls.at(-1)[2]).toHaveLength(2 * MAX_EXCHANGES - 1);
  });
});
