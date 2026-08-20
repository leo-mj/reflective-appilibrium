// @vitest-environment jsdom
//
// ActionButtons is the only entry point to withdrawing and reinstating, so which
// buttons appear decides whether an item that was set aside can come back.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { Ctx } from "./TextTabContext.js";
import {
  ActionButtons,
  Badge,
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

  describe("compact", () => {
    const buttons = (c) => [...c.querySelectorAll("button")];

    const render3 = (compact) =>
      render(
        <ActionButtons
          compact={compact}
          onRevise={() => {}}
          onWithdraw={() => {}}
          onReinstate={() => {}}
        />,
      ).container;

    it("drops every button to the metadata chips' type scale", () => {
      // MetaChip is 10px. Wide, the chips and the buttons share one line, and
      // the point of this is that they read as one band.
      buttons(render3(true)).forEach((b) => {
        expect(b.style.fontSize).toBe("10px");
      });
    });

    it("keeps the larger text when it is not compact", () => {
      // Narrow, and the graph's pinned-node tooltip, which passes nothing.
      buttons(render3(false)).forEach((b) => {
        expect(b.style.fontSize).toBe("12px");
      });
    });

    it("never drops a button under the 24px target-size floor", () => {
      // Carried by minHeight rather than by the padding, so a font whose metrics
      // differ from the one this was measured against cannot quietly shrink it
      // past WCAG 2.2 AA. jsdom has no layout, so the declaration is what there
      // is to check — which is also the thing a careless edit would remove.
      buttons(render3(true)).forEach((b) => {
        expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(24);
      });
    });

    it("still asks for the touch target class in either size", () => {
      // `.tap-target` keys on the pointer, not the viewport, so a wide screen
      // that is thumbed has to get the smaller text and the 36px target both.
      [true, false].forEach((compact) => {
        buttons(render3(compact)).forEach((b) => {
          expect(b.className).toContain("tap-target");
        });
      });
    });

    it("keeps withdraw looking like the destructive one", () => {
      // The compact override is size only: it must not flatten the fill that
      // separates Withdraw from the ghost buttons beside it.
      const withdraw = buttons(render3(true)).find(
        (b) => b.textContent.trim() === "Withdraw",
      );
      expect(withdraw.style.background).not.toBe("");
      expect(withdraw.style.background).not.toBe("none");
    });
  });
});

describe("Badge", () => {
  const renderBadge = (id, ctx = {}) =>
    render(
      <Ctx.Provider
        value={{
          badgeColor: () => "#888",
          badgeTextColor: () => "#ccc",
          selected: null,
          onSelect: () => {},
          ...ctx,
        }}
      >
        <Badge id={id} />
      </Ctx.Provider>,
    );

  it("is a button, not a span with a click handler", () => {
    // Selecting an element from the text is only possible here, so it has to be
    // reachable by keyboard and announce itself as something that can be
    // pressed.
    const { container } = renderBadge("J1");
    const badge = container.querySelector("button");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("J1");
    // A name with a word in it, per the audit in a11y.test.jsx — and one that
    // still contains the visible "J1", so voice control can ask for it by what
    // it says on screen.
    expect(badge.getAttribute("aria-label")).toBe("Select J1");
  });

  it("carries its selected state where a screen reader can find it", () => {
    // Until now selection was visible only as a change of colour.
    const { container } = renderBadge("J1", { selected: "J1" });
    expect(container.querySelector("button").getAttribute("aria-pressed")).toBe(
      "true",
    );

    cleanup();
    const other = renderBadge("J1", { selected: "P2" });
    expect(
      other.container.querySelector("button").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("toggles the selection off when it is already selected", () => {
    const onSelect = vi.fn();
    const { container } = renderBadge("J1", { selected: "J1", onSelect });
    fireEvent.click(container.querySelector("button"));

    // Called with an updater, so the assertion is on what the updater does.
    const update = onSelect.mock.calls[0][0];
    expect(update("J1")).toBeNull();
    expect(update("P2")).toBe("J1");
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
  it("labels every event type, including reinstatement", () => {
    for (const type of ["withdrawn", "rejected", "revised", "reinstated"]) {
      const { container } = render(<StatusLabel tag={{ type }} />);
      expect(container.textContent).toBe(type);
      cleanup();
    }
  });

  it("ignores an event type it has no colour for", () => {
    const { container } = render(<StatusLabel tag={{ type: "teleported" }} />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing for an active element", () => {
    const { container } = render(<StatusLabel tag={null} />);
    expect(container.textContent).toBe("");
  });

  it("dates the status when the round is known", () => {
    const { container } = render(<StatusLabel tag={{ type: "withdrawn", round: 5 }} />);
    expect(container.textContent).toBe("withdrawn · Round 5");
  });

  it("omits the round when nothing recorded it", () => {
    const { container } = render(<StatusLabel tag={{ type: "revised" }} />);
    expect(container.textContent).toBe("revised");
  });
});
