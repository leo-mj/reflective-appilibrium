// @vitest-environment jsdom
//
// ActionButtons is the only entry point to withdrawing and reinstating, so which
// buttons appear decides whether an item that was set aside can come back.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import {
  ActionButtons,
  StatusLabel,
  AddedRound,
  HistoryRoundBanner,
} from "./TextTabPrimitives.jsx";

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

describe("AddedRound", () => {
  it("names the round the item first appeared in", () => {
    const { container } = render(<AddedRound round={4} />);
    expect(container.textContent).toBe("Added: Round 4");
  });

  it("renders nothing when the round is missing", () => {
    // Hand-written and older states are allowed to omit it.
    for (const round of [undefined, null, 0]) {
      const { container } = render(<AddedRound round={round} />);
      expect(container.textContent).toBe("");
      cleanup();
    }
  });
});

describe("HistoryRoundBanner", () => {
  it("renders nothing outside history mode", () => {
    const { container } = render(<HistoryRoundBanner historyView={null} />);
    expect(container.textContent).toBe("");
  });

  it("names the round being viewed and the total", () => {
    const { container } = render(
      <HistoryRoundBanner historyView={{ round: 3, maxRound: 9 }} />,
    );
    expect(container.textContent).toBe("Round 3 of 9");
  });

  it("marks the last round as current", () => {
    const { container } = render(
      <HistoryRoundBanner historyView={{ round: 9, maxRound: 9 }} />,
    );
    expect(container.textContent).toContain("current");
  });

  it("explains the empty round 0", () => {
    const { container } = render(
      <HistoryRoundBanner historyView={{ round: 0, maxRound: 9 }} />,
    );
    expect(container.textContent).toContain("before anything was recorded");
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
