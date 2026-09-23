// @vitest-environment jsdom
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const pairs = [{ a: "J3", b: "J1", reason: "Both condemn lying to friends." }];
vi.mock("../../utils/elementMergeClient.js", () => ({
  fetchMergePairs: vi.fn(async () => ({
    suggestions: pairs,
    model: "some-model",
  })),
}));

import { ElementMergeTab } from "./ElementMergeTab.jsx";

// jsdom has nothing to scroll, so the calls are recorded instead.
let scrolled = [];
beforeEach(() => {
  scrolled = [];
  Element.prototype.scrollTo = function (opts) {
    scrolled.push(opts);
  };
});

afterEach(() => {
  cleanup();
  delete Element.prototype.scrollTo;
});

const el = (id, text, confidence = 0.7) => ({
  id,
  type: "judgment",
  status: "active",
  confidence,
  origin: "user",
  text,
  addedRound: 1,
});
const PROCESSES = [
  { id: "A", label: "Lying", members: ["J1"] },
  { id: "B", label: "Friends", members: ["J3"] },
];
const state = {
  topic: "t",
  round: 2,
  elements: [
    el("J1", "Lying to a friend is wrong."),
    el("J3", "Never lie to friends.", 0.9),
  ],
  relations: [],
  log: [],
};

const open = async (props = {}) => {
  const onMergeElements = vi.fn();
  render(
    <ElementMergeTab
      state={state}
      processes={PROCESSES}
      onMergeElements={onMergeElements}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Find pairs/ }));
  await screen.findByTestId("merge-pair");
  return onMergeElements;
};

describe("ElementMergeTab", () => {
  it("offers the element from the earlier process as the one kept", async () => {
    const onMerge = await open();
    expect(screen.getByText("Both condemn lying to friends.")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    expect(onMerge).toHaveBeenCalledWith({
      keepId: "J1",
      removeId: "J3",
      text: "Lying to a friend is wrong.",
      confidence: 0.7,
      reason: "Both condemn lying to friends.",
    });
    expect(screen.queryByTestId("merge-pair")).toBeNull();
  });

  it("keeps the other side, reworded, when the reader says so", async () => {
    const onMerge = await open();
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]); // J3, as the model listed it first

    // No box until Modify is pressed — it is the answer to that, not a field
    // open on every card.
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Modify/ }));
    const box = screen.getByRole("textbox");
    expect(box.value).toBe("Never lie to friends.");
    fireEvent.change(box, { target: { value: "Never lie to a friend." } });

    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    expect(onMerge).toHaveBeenCalledWith(
      expect.objectContaining({
        keepId: "J3",
        removeId: "J1",
        text: "Never lie to a friend.",
        confidence: 0.9,
      }),
    );
  });

  it("drops a draft on cancel, and on switching sides", async () => {
    const onMerge = await open();
    fireEvent.click(screen.getByRole("button", { name: /Modify/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Rewritten." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(screen.queryByRole("textbox")).toBeNull();

    // Switching sides closes the box too: the draft was written against the
    // wording just abandoned.
    fireEvent.click(screen.getByRole("button", { name: /Modify/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Rewritten again." },
    });
    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    expect(onMerge).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Never lie to friends." }),
    );
  });

  // The cards each carry a wording box. One that took the focus as it mounted
  // would leave the panel scrolled to the last card, past the toolbar and the
  // first pairs — which is what happened while the box kept its default focus.
  it("leaves the focus alone, and shows the list from the top", async () => {
    await open();
    expect(document.activeElement).toBe(document.body);
    // That it happened, not how many times: an effect may legitimately run
    // twice for one render.
    expect(scrolled).toContainEqual({ top: 0 });
  });

  it("merges nothing when a pair is dismissed", async () => {
    const onMerge = await open();
    fireEvent.click(screen.getByRole("button", { name: /Reject/ }));
    expect(onMerge).not.toHaveBeenCalled();
    expect(screen.getByText("No pairs to review.")).not.toBeNull();
  });
});
