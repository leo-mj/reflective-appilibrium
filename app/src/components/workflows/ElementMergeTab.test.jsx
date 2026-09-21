// @vitest-environment jsdom
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../../utils/elementMergeClient.js", () => ({
  fetchMergePairs: vi.fn(async () => ({
    suggestions: [{ a: "J3", b: "J1", reason: "Both condemn lying to friends." }],
    model: "some-model",
  })),
}));

import { ElementMergeTab } from "./ElementMergeTab.jsx";

afterEach(cleanup);

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
  elements: [el("J1", "Lying to a friend is wrong."), el("J3", "Never lie to friends.", 0.9)],
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
    const box = screen.getByRole("textbox");
    expect(box.value).toBe("Never lie to friends.");
    fireEvent.change(box, { target: { value: "Never lie to a friend." } });
    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    expect(onMerge).toHaveBeenCalledWith(
      expect.objectContaining({ keepId: "J3", removeId: "J1", text: "Never lie to a friend.", confidence: 0.9 }),
    );
  });

  it("merges nothing when a pair is dismissed", async () => {
    const onMerge = await open();
    fireEvent.click(screen.getByRole("button", { name: /Reject/ }));
    expect(onMerge).not.toHaveBeenCalled();
    expect(screen.getByText("No pairs to review.")).not.toBeNull();
  });
});
