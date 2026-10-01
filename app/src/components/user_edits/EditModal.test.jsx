// @vitest-environment jsdom
//
// An unchanged save used to advance the round and mark the element revised,
// so Save waits for something to have changed.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { EditModal } from "./EditModal.jsx";

afterEach(cleanup);

const element = {
  id: "J1",
  type: "judgment",
  status: "active",
  confidence: 0.7,
  origin: "user",
  text: "Lying is wrong.",
  addedRound: 1,
};

const save = () => screen.getByRole("button", { name: "Save" });
const text = () => screen.getByDisplayValue("Lying is wrong.");

describe("EditModal", () => {
  it("offers Save only once a field has changed, and not once it is changed back", () => {
    render(<EditModal element={element} currentRound={1} onSave={() => {}} onCancel={() => {}} />);
    expect(save().disabled).toBe(true);

    fireEvent.change(text(), { target: { value: "Lying is usually wrong." } });
    expect(save().disabled).toBe(false);

    fireEvent.change(screen.getByDisplayValue("Lying is usually wrong."), {
      target: { value: "Lying is wrong." },
    });
    expect(save().disabled).toBe(true);
  });

  it("counts a change of type as a change", () => {
    const onSave = vi.fn();
    render(<EditModal element={element} currentRound={1} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByDisplayValue("Judgment"), { target: { value: "principle" } });
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: "principle" }));
  });

  it("does not save an unchanged form on Ctrl+Enter either", () => {
    const onSave = vi.fn();
    render(<EditModal element={element} currentRound={1} onSave={onSave} onCancel={() => {}} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter", ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });
});
