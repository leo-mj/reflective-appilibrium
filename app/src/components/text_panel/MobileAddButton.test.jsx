// @vitest-environment jsdom
//
// The narrow screen's + hosts the wide layout's AddBar rather than a pair of
// dialogs of its own, so what the bar offers is AddBar's business and is tested
// in TextTabAddPanel.test.jsx. What is tested here is the wiring: that opening
// the sheet really produces that bar, that the arguments-only setting reaches
// it, and that a multi-premise argument survives the trip.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { MobileAddButton } from "./MobileAddButton.jsx";

afterEach(cleanup);

const ELEMENTS = [
  { id: "J1", type: "judgment", status: "active" },
  { id: "J2", type: "judgment", status: "active" },
  { id: "P1", type: "principle", status: "active" },
];

function renderButton(props = {}) {
  return render(
    <MobileAddButton
      elements={ELEMENTS}
      onAddElement={() => {}}
      onAddRelation={() => {}}
      {...props}
    />,
  );
}

const openSheet = () =>
  fireEvent.click(screen.getByLabelText("Add to your position"));

describe("MobileAddButton", () => {
  it("shows nothing but the + until it is opened", () => {
    renderButton();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Element")).toBeNull();
  });

  it("opens the same bar the wide layout keeps at the foot of the panel", () => {
    renderButton();
    openSheet();

    expect(screen.getByRole("dialog")).toBeTruthy();
    // The three tabs, including the argument one the old two-item menu had no
    // way to reach.
    expect(screen.getByText("Element")).toBeTruthy();
    expect(screen.getByText("Relation")).toBeTruthy();
    expect(screen.getByText("Argument")).toBeTruthy();
  });

  it("withholds relations when the graph is showing arguments only", () => {
    renderButton({ hideNonEntailsRels: true });
    openSheet();

    expect(screen.queryByText("Relation")).toBeNull();
    expect(screen.getByText("Argument")).toBeTruthy();
  });

  it("adds a multi-premise argument as one grouped set of relations", () => {
    const onAddRelation = vi.fn();
    renderButton({ hideNonEntailsRels: true, onAddRelation });
    openSheet();

    fireEvent.click(screen.getByText("Argument"));
    fireEvent.click(screen.getByText("+ premise"));
    ["J1", "J2"].forEach((id, i) =>
      fireEvent.change(screen.getByLabelText(`Premise ${i + 1}`), {
        target: { value: id },
      }),
    );
    fireEvent.change(screen.getByLabelText("Conclusion"), {
      target: { value: "P1" },
    });
    fireEvent.click(screen.getByText(/^Add argument$/));

    expect(onAddRelation).toHaveBeenCalledTimes(2);
    const [first, second] = onAddRelation.mock.calls.map(([rel]) => rel);
    expect(first.argumentId).toBe(second.argumentId);
    expect([first.from, second.from]).toEqual(["J1", "J2"]);
    expect(first.type).toBe("jointly_entails");
  });

  it("closes on the backdrop as well as the ✕", () => {
    const { container } = renderButton();

    openSheet();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("dialog")).toBeNull();

    openSheet();
    // The backdrop carries no label of its own — it is the fixed layer sitting
    // under the sheet, and tapping away from a sheet has to close it.
    const backdrop = [...container.querySelectorAll("div")].find(
      (d) => d.style.position === "fixed" && d.style.inset === "0px",
    );
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
