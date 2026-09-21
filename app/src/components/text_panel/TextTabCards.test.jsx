// @vitest-environment jsdom
//
// A card's stats are named fields under the claim — a caption over a value —
// reading left to right as: how firmly it is held, where it came from, when it
// arrived, and what has since happened to it. These tests pin that order, the
// status-dependent styling that goes with it, and the fold that hides the lot.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";

import { Ctx } from "./TextTabContext.js";
import { setCardDetails } from "./cardDetails.js";
import { ElementCard, RelationCard } from "./TextTabCards.jsx";
import { tooltipText } from "../tooltipTestUtils.js";

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

/** Every stat field as `[caption, value]`, in document order. */
const stats = (container) =>
  [...container.querySelectorAll("[data-stat]")].map((f) => [
    f.dataset.stat,
    f.lastElementChild.textContent.trim(),
  ]);

/** One field's value by caption, or undefined if the card has no such field. */
const stat = (container, label) =>
  stats(container).find(([name]) => name === label)?.[1];

/** Just the captions, for order. */
const captions = (container) => stats(container).map(([name]) => name);

describe("ElementCard metadata order", () => {
  it("names the confidence, origin, added round and status, in that order", () => {
    const { container } = renderIn(
      <ElementCard
        e={el({ status: "revised", revisedRound: 5 })}
        dim={false}
      />,
    );
    expect(captions(container)).toEqual([
      "Confidence",
      "Origin",
      "Added",
      "Status",
    ]);
    expect(stat(container, "Added")).toBe("Round 3");
    expect(stat(container, "Status")).toBe("Revised · Round 5");
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
    expect(stat(container, "Status")).toBe("Withdrawn · Round 8");
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
    expect(stat(container, "Status")).toBe("Withdrawn · Round 4");
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
    expect(stat(container, "Status")).toBe("Reinstated · Round 7");
    // Back in play, so it reads as live text rather than a withdrawal.
    expect(container.textContent).not.toContain("Withdrawn: Too broad");
  });

  it("does the same for a withdrawn element", () => {
    const { container } = renderIn(
      <ElementCard
        e={el({ status: "withdrawn", reason: "Too broad" })}
        dim={false}
      />,
    );
    expect(stat(container, "Status")).toBe("Withdrawn");
  });

  it("names only the added round for an element in play", () => {
    const { container } = renderIn(<ElementCard e={el()} dim={false} />);
    expect(stat(container, "Added")).toBe("Round 3");
    expect(captions(container)).not.toContain("Status");
    expect(container.textContent).not.toContain("Withdrawn");
    expect(container.textContent).not.toContain("Revised");
  });

  // The panel's heading carries the round, so a `Status: Revised` field beside
  // it would say the same thing twice in one card.
  it("leaves the status to the previous-wording panel after a revision", () => {
    const { container } = renderIn(
      <ElementCard
        e={el({
          status: "revised",
          revisedRound: 5,
          previousText: "Torture is bad.",
        })}
        dim={false}
      />,
    );
    expect(captions(container)).not.toContain("Status");
    expect(container.textContent).toContain("Revised in round 5");
    expect(container.textContent).toContain("Torture is bad.");
  });

  it("still names the status when a revision left no previous wording", () => {
    // Hand-written and imported states both allow it.
    const { container } = renderIn(
      <ElementCard
        e={el({ status: "revised", revisedRound: 5 })}
        dim={false}
      />,
    );
    expect(stat(container, "Status")).toBe("Revised · Round 5");
  });

  it("strikes through a withdrawn element and shows its reason", () => {
    const { container } = renderIn(
      <ElementCard
        e={el({ status: "withdrawn", reason: "Too broad" })}
        dim={false}
      />,
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
      <ElementCard
        e={el({ status: "active", reason: "Too broad" })}
        dim={false}
      />,
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
  it("names its stats in the same order an element card does", () => {
    const { container } = renderIn(
      <RelationCard r={rel({ status: "withdrawn" })} dim={false} />,
    );
    expect(captions(container)).toEqual(["Origin", "Added", "Status"]);
    expect(stat(container, "Added")).toBe("Round 2");
    expect(stat(container, "Status")).toBe("Withdrawn");
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
    const { container } = renderIn(<ElementCard e={el()} />, {
      groups: GROUPS,
    });
    expect(stat(container, "Group")).toBe("Duties");
  });

  it("says nothing when it belongs to none", () => {
    const { container } = renderIn(<ElementCard e={el()} />, { groups: [] });
    expect(captions(container)).not.toContain("Group");
  });

  it("survives a state written before groups existed", () => {
    const { container } = renderIn(<ElementCard e={el()} />);
    expect(captions(container)).not.toContain("Group");
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

// ─── The details fold ─────────────────────────────────────────────────────────

describe("an element card's details", () => {
  const toggle = (container) => container.querySelector("[aria-expanded]");

  // The store outlives a render, being the panel's preference rather than a
  // card's own state, so each test has to put it back.
  afterEach(() => setCardDetails(true));

  it("opens showing them, the stats being most of what a card says", () => {
    const { container } = renderIn(<ElementCard e={el()} dim={false} />);
    expect(toggle(container).getAttribute("aria-expanded")).toBe("true");
    expect(toggle(container).textContent).toContain("Hide details");
  });

  it("hides them on a press, leaving the claim and the buttons", () => {
    const { container } = renderIn(<ElementCard e={el()} dim={false} />);
    fireEvent.click(toggle(container));
    expect(toggle(container).getAttribute("aria-expanded")).toBe("false");
    expect(toggle(container).textContent).toContain("Show details");
    // Folded with `display`, so the region is still in the tree.
    const region = container.querySelector(
      `#${toggle(container).getAttribute("aria-controls")}`,
    );
    expect(region.style.display).toBe("none");
    expect(container.textContent).toContain("Torturing is wrong.");
  });

  // One answer for the whole panel: folding is how a reader says they want to
  // read a list, and per card it took two dozen presses to mean it.
  it("folds every card in the list, not just the one pressed", () => {
    const { container } = renderIn(
      <>
        <ElementCard e={el()} dim={false} />
        <ElementCard e={el({ id: "J2" })} dim={false} />
      </>,
    );
    const toggles = [...container.querySelectorAll("[aria-expanded]")];
    fireEvent.click(toggles[0]);
    expect(toggles.map((t) => t.getAttribute("aria-expanded"))).toEqual([
      "false",
      "false",
    ]);
  });

  it("is still folded for a card rendered afterwards", () => {
    // It outlives the panel: leaving the text tab and coming back is not an
    // instruction to unfold everything again.
    setCardDetails(false);
    const { container } = renderIn(<ElementCard e={el()} dim={false} />);
    expect(toggle(container).getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the withdrawal scores", () => {
  const DELTAS = { J1: { delta_account: -0.048, delta_systematicity: -0.132 } };

  const widths = (container) =>
    [...container.querySelectorAll('[aria-hidden="true"]')]
      .filter((b) => b.firstElementChild?.style.width)
      .map((b) => b.firstElementChild.style.width);

  it("writes each one out beside a bar of its magnitude", () => {
    const { container } = renderIn(<ElementCard e={el()} dim={false} />, {
      withdrawalDeltas: DELTAS,
      withdrawalScale: 0.2,
    });
    expect(container.textContent).toContain("If withdrawn");
    expect(container.textContent).toContain("-0.048");
    expect(container.textContent).toContain("-0.132");
    // The bars are decorative: the numbers are what a reader acts on, and a
    // screen reader would otherwise meet two unlabelled boxes.
    expect(widths(container)).toEqual(["24%", "66%"]);
  });

  // A withdrawal moves account by (2D ± 1)/N², so on a 0–1 axis every bar in
  // the panel was a two-pixel sliver — and the smaller for the larger process.
  it("draws them against the panel's scale, not 0–1", () => {
    const { container } = renderIn(<ElementCard e={el()} dim={false} />, {
      withdrawalDeltas: DELTAS,
      withdrawalScale: 0.05,
    });
    // Past the scale's own maximum it fills the track rather than overflowing.
    expect(widths(container)).toEqual(["96%", "100%"]);
  });

  it("names the scale on hover, the bar having no visible axis", () => {
    // Through the app's own Tooltip, not the DOM's `title`, so it has to be
    // hovered and waited out like any other.
    vi.useFakeTimers();
    const { container } = renderIn(<ElementCard e={el()} dim={false} />, {
      withdrawalDeltas: DELTAS,
      withdrawalScale: 0.2,
    });
    const account = [...container.querySelectorAll("div")].find(
      (d) => d.textContent === "Account-0.048",
    );
    fireEvent.mouseEnter(account);
    act(() => vi.advanceTimersByTime(400));
    expect(
      [...document.body.querySelectorAll("div")].some(
        (d) =>
          d.style.position === "fixed" &&
          d.textContent === "Account change if withdrawn (bar drawn to ±0.2)",
      ),
    ).toBe(true);
    vi.useRealTimers();
  });

  it("derives a scale when its host hands it none", () => {
    // The cards must not draw a bar to `undefined` in a surface that has the
    // deltas but not the panel's own memo.
    const { container } = renderIn(<ElementCard e={el()} dim={false} />, {
      withdrawalDeltas: DELTAS,
    });
    expect(widths(container)).toEqual(["24%", "66%"]);
  });

  it("says nothing about withdrawing an element already out of play", () => {
    const { container } = renderIn(
      <ElementCard e={el({ status: "withdrawn" })} dim={false} />,
      { withdrawalDeltas: DELTAS },
    );
    expect(container.textContent).not.toContain("If withdrawn");
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
      <ElementCard
        e={el({ type: "theory", sources: [aBook()] })}
        dim={false}
      />,
    );
    expect(container.textContent).toContain(
      "Parfit, D. (1984). Reasons and persons. Oxford University Press.",
    );
  });

  it("labels them as AI-generated, with the caveat on hover", () => {
    const { getByText } = renderIn(
      <ElementCard
        e={el({ type: "theory", sources: [aBook()] })}
        dim={false}
      />,
    );
    const label = getByText("Sources (AI-generated):");
    // A Crossref match establishes that a work exists, never that it says what
    // the element claims — the gap where a confident-looking error hides.
    expect(tooltipText(label)).toMatch(/not checked/i);
  });

  it("links a confirmed reference to its DOI", () => {
    const { getByRole } = renderIn(
      <ElementCard
        e={el({ type: "theory", sources: [aBook({ doi: "10.1234/abc" })] })}
        dim={false}
      />,
    );
    expect(getByRole("link").getAttribute("href")).toBe(
      "https://doi.org/10.1234/abc",
    );
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
