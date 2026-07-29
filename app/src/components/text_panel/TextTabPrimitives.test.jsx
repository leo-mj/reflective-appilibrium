// @vitest-environment jsdom
//
// ActionButtons is the only entry point to withdrawing and reinstating, so which
// buttons appear decides whether an item that was set aside can come back.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { ActionButtons, StatusLabel } from "./TextTabPrimitives.jsx";

afterEach(cleanup);

const labels = (c) =>
  [...c.querySelectorAll("button")].map((b) => b.textContent.trim());

describe("ActionButtons", () => {
  it("offers withdraw, not reinstate, for an item in play", () => {
    const { container } = render(
      <ActionButtons onRevise={() => {}} onWithdraw={() => {}} onReinstate={null} />,
    );
    expect(labels(container)).toEqual(["Revise", "Withdraw"]);
  });

  it("offers reinstate, not withdraw, for one that is out", () => {
    const { container } = render(
      <ActionButtons onRevise={() => {}} onWithdraw={null} onReinstate={() => {}} />,
    );
    expect(labels(container)).toEqual(["Revise", "Reinstate"]);
  });

  it("shows revise alone when neither is available", () => {
    const { container } = render(<ActionButtons onRevise={() => {}} />);
    expect(labels(container)).toEqual(["Revise"]);
  });

  it("calls the handler it was given", () => {
    const onReinstate = vi.fn();
    const { container } = render(
      <ActionButtons onRevise={() => {}} onReinstate={onReinstate} />,
    );
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Reinstate",
      ),
    );
    expect(onReinstate).toHaveBeenCalledTimes(1);
  });
});

describe("StatusLabel", () => {
  it("labels the statuses that differ from being in play", () => {
    for (const status of ["withdrawn", "rejected", "revised"]) {
      const { container } = render(<StatusLabel status={status} />);
      expect(container.textContent).toBe(status);
      cleanup();
    }
  });

  it("renders nothing for an active element", () => {
    const { container } = render(<StatusLabel status="active" />);
    expect(container.textContent).toBe("");
  });
});
