// @vitest-environment jsdom
//
// Card metadata rows read left to right as: what it is, where it came from, when
// it arrived, and only then how its status has since changed. These tests pin
// that order, and the status-dependent styling that goes with it.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { Ctx } from "./TextTabContext.js";
import { ElementCard, RelationCard } from "./TextTabCards.jsx";

afterEach(cleanup);

const CTX = {
  state: { elements: [], relations: [] },
  selected: null,
  onSelect: () => {},
  selectedRel: null,
  onSelectRel: () => {},
  onEditRequest: () => {},
  onEditRelRequest: () => {},
  onWithdrawRequest: () => {},
  onWithdrawRelRequest: () => {},
  onReinstate: () => {},
  onReinstateRel: () => {},
  badgeColor: () => "#888",
  pCovers: {},
  search: "",
  withdrawalDeltas: null,
};

const renderIn = (ui, ctx = {}) =>
  render(<Ctx.Provider value={{ ...CTX, ...ctx }}>{ui}</Ctx.Provider>);

const el = (overrides = {}) => ({
  id: "J1",
  type: "judgment",
  status: "active",
  confidence: 0.67,
  origin: "user",
  text: "Torturing is wrong.",
  addedRound: 3,
  ...overrides,
});

const rel = (overrides = {}) => ({
  from: "J1",
  to: "P1",
  type: "supports",
  explanation: "Because.",
  origin: "user",
  addedRound: 2,
  status: "active",
  ...overrides,
});

/** Chip and label text in document order. */
const chips = (container) =>
  [...container.querySelectorAll("span")]
    .map((s) => s.textContent.trim())
    .filter(Boolean);

/** Index of the first chip containing `text`, or -1. */
const at = (container, text) =>
  chips(container).findIndex((c) => c.includes(text));

describe("ElementCard metadata order", () => {
  it("puts the status tag after the added round", () => {
    const { container } = renderIn(
      <ElementCard e={el({ status: "revised" })} dim={false} />,
    );
    expect(at(container, "Added: Round 3")).toBeGreaterThan(
      at(container, "Origin:"),
    );
    expect(at(container, "revised")).toBeGreaterThan(
      at(container, "Added: Round 3"),
    );
  });

  it("dates the status from the element's history", () => {
    const { container } = renderIn(
      <ElementCard
        e={el({
          status: "withdrawn",
          history: [
            { round: 4, type: "withdrawn" },
            { round: 6, type: "reinstated" },
            { round: 8, type: "withdrawn" },
          ],
        })}
        dim={false}
      />,
      { state: { elements: [], relations: [], round: 9 } },
    );
    expect(container.textContent).toContain("withdrawn · Round 8");
  });

  it("dates it by the round being viewed in history playback", () => {
    const e = el({
      status: "withdrawn",
      history: [
        { round: 4, type: "withdrawn" },
        { round: 6, type: "reinstated" },
        { round: 8, type: "withdrawn" },
      ],
    });
    const { container } = renderIn(<ElementCard e={e} dim={false} />, {
      state: { elements: [], relations: [], round: 5 },
    });
    expect(container.textContent).toContain("withdrawn · Round 4");
  });

  it("marks an element that came back, which its status alone cannot show", () => {
    const { container } = renderIn(
      <ElementCard
        e={el({
          status: "active",
          history: [
            { round: 3, type: "withdrawn", reason: "Too broad" },
            { round: 7, type: "reinstated" },
          ],
        })}
        dim={false}
      />,
      { state: { elements: [], relations: [], round: 9 } },
    );
    expect(container.textContent).toContain("reinstated · Round 7");
    // Back in play, so it reads as live text rather than a withdrawal.
    expect(container.textContent).not.toContain("Withdrawn: Too broad");
  });

  it("does the same for a withdrawn element", () => {
    const { container } = renderIn(
      <ElementCard e={el({ status: "withdrawn", reason: "Too broad" })} dim={false} />,
    );
    expect(at(container, "withdrawn")).toBeGreaterThan(
      at(container, "Added: Round 3"),
    );
  });

  it("shows no status tag for an element in play", () => {
    const { container } = renderIn(<ElementCard e={el()} dim={false} />);
    expect(chips(container)).not.toContain("withdrawn");
    expect(chips(container)).not.toContain("revised");
  });

  it("strikes through a withdrawn element and shows its reason", () => {
    const { container } = renderIn(
      <ElementCard e={el({ status: "withdrawn", reason: "Too broad" })} dim={false} />,
    );
    expect(container.textContent).toContain("Withdrawn: Too broad");
    const body = [...container.querySelectorAll("div")].find((d) =>
      d.textContent.startsWith("Torturing"),
    );
    expect(body.style.textDecoration).toBe("line-through");
  });

  it("hides the reason once the element is back in play", () => {
    // `reason` is kept as history after reinstatement, but is not current.
    const { container } = renderIn(
      <ElementCard e={el({ status: "active", reason: "Too broad" })} dim={false} />,
    );
    expect(container.textContent).not.toContain("Withdrawn: Too broad");
  });

  it("offers reinstate rather than withdraw when out of play", () => {
    const onReinstate = vi.fn();
    const { container } = renderIn(
      <ElementCard e={el({ status: "rejected" })} dim={false} />,
      { onReinstate },
    );
    // Scoped to the action group: the card's id badge is a button too, and it
    // is not one of the actions this is about.
    const actions = container.querySelector('[role="group"]');
    const labels = [...actions.querySelectorAll("button")].map((b) =>
      b.textContent.trim(),
    );
    expect(labels).toEqual(["Revise", "Reinstate"]);
  });
});

describe("RelationCard metadata order", () => {
  it("puts the status tag after the added round", () => {
    const { container } = renderIn(
      <RelationCard r={rel({ status: "withdrawn" })} dim={false} />,
    );
    expect(at(container, "Added: Round 2")).toBeGreaterThan(
      at(container, "Origin:"),
    );
    expect(at(container, "withdrawn")).toBeGreaterThan(
      at(container, "Added: Round 2"),
    );
  });

  it("renders the relation type between its endpoints", () => {
    const { container } = renderIn(<RelationCard r={rel()} dim={false} />);
    expect(container.textContent).toContain("supports");
  });
});
