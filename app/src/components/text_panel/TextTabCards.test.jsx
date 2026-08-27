// @vitest-environment jsdom
//
// Card metadata rows read left to right as: what it is, where it came from, when
// it arrived, and only then how its status has since changed. These tests pin
// that order, and the status-dependent styling that goes with it.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

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
  badgeFill: () => "#444",
  badgeTextColor: () => "#ccc",
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

// ─── Group membership ─────────────────────────────────────────────────────────

describe("an element that belongs to a group", () => {
  const GROUPS = [
    { id: "G1", label: "Duties", members: ["J1"], collapsed: true },
  ];

  it("says so, since a collapsed group is why it is not on the canvas", () => {
    const { container } = renderIn(<ElementCard e={el()} />, { groups: GROUPS });
    expect(container.textContent).toContain("Group: Duties");
  });

  it("says nothing when it belongs to none", () => {
    const { container } = renderIn(<ElementCard e={el()} />, { groups: [] });
    expect(container.textContent).not.toContain("Group:");
  });

  it("survives a state written before groups existed", () => {
    const { container } = renderIn(<ElementCard e={el()} />);
    expect(container.textContent).not.toContain("Group:");
  });

  it("selects the group from the tag", () => {
    const onSelect = vi.fn();
    const { container } = renderIn(<ElementCard e={el()} />, {
      groups: GROUPS,
      onSelect,
    });
    fireEvent.click(
      container.querySelector('[aria-label="Select group Duties"]'),
    );
    expect(onSelect.mock.calls[0][0](null)).toBe("G1");
  });
});

describe("ElementCard sources", () => {
  const aBook = (over = {}) => ({
    type: "book",
    authors: ["Parfit, D."],
    year: "1984",
    title: "Reasons and persons",
    container: "",
    editors: [],
    publisher: "Oxford University Press",
    volume: "",
    issue: "",
    pages: "",
    doi: "",
    ...over,
  });

  it("shows the reference an accepted theory was attributed to", () => {
    // Without this the citation is invisible between accepting a suggestion and
    // exporting it, which is most of the time the user spends with it.
    const { container } = renderIn(
      <ElementCard e={el({ type: "theory", sources: [aBook()] })} dim={false} />,
    );
    expect(container.textContent).toContain(
      "Parfit, D. (1984). Reasons and persons. Oxford University Press.",
    );
  });

  it("labels them as AI-generated, with the caveat on hover", () => {
    const { getByText } = renderIn(
      <ElementCard e={el({ type: "theory", sources: [aBook()] })} dim={false} />,
    );
    const label = getByText("Sources (AI-generated):");
    // A Crossref match establishes that a work exists, never that it says what
    // the element claims — the gap where a confident-looking error hides.
    expect(label.getAttribute("title")).toMatch(/not checked/i);
  });

  it("links a confirmed reference to its DOI", () => {
    const { getByRole } = renderIn(
      <ElementCard
        e={el({ type: "theory", sources: [aBook({ doi: "10.1234/abc" })] })}
        dim={false}
      />,
    );
    expect(getByRole("link").getAttribute("href")).toBe("https://doi.org/10.1234/abc");
  });

  it("renders nothing for an element with no sources", () => {
    const { container } = renderIn(<ElementCard e={el()} dim={false} />);
    expect(container.textContent).not.toContain("Sources");
  });

  it("renders nothing for an element written before the field existed", () => {
    const { container } = renderIn(
      <ElementCard e={el({ sources: undefined })} dim={false} />,
    );
    expect(container.textContent).not.toContain("Sources");
  });
});
