// @vitest-environment jsdom
//
// Renders the real TheorySuggestTab with the client mocked, so accept / reject /
// modify and the three verification states can be exercised without the network.
//
// Two assertions here are load-bearing rather than incidental. `not_found` must
// not be worded or coloured as suspicion — Crossref does not index every
// philosophy monograph, and flagging the canon would be worse than not checking
// at all. And `verification` must not reach the accepted element: it is a
// snapshot that goes stale, where the DOI it yielded is a fact.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

// Built inside the factory: `vi.mock` is hoisted above every top-level const,
// so a fixture declared outside would not exist yet when this runs.
//
// The three suggestions between them cover every state the card can be in: a
// confirmed reference with a DOI, an unmatched one, and a suggestion with no
// references at all.
vi.mock("../../utils/theoriesClient.js", () => {
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
    doi: "10.1093/019824908x.001.0001",
    verification: "matched",
    ...over,
  });
  return {
    fetchTheorySuggestions: vi.fn().mockResolvedValue({
      model: "test-model",
      suggestions: [
        {
          text: "A person is harmed only if made worse off than they would otherwise be.",
          confidence: 0.67,
          sources: [aBook()],
        },
        {
          text: "Moral status attaches to the capacity for wellbeing.",
          confidence: 0.67,
          sources: [
            aBook({ title: "An unindexed book", doi: "", verification: "not_found" }),
          ],
        },
        {
          text: "Persons persist through psychological continuity.",
          confidence: 0.67,
          sources: [],
        },
      ],
    }),
  };
});

import { TheorySuggestTab } from "./TheorySuggestTab.jsx";
import { fetchTheorySuggestions } from "../../utils/theoriesClient.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const aState = (overrides = {}) => ({
  topic: "Obligations to future generations",
  round: 4,
  elements: [
    {
      id: "P1",
      type: "principle",
      status: "active",
      confidence: 0.67,
      text: "A principle",
      addedRound: 1,
    },
  ],
  relations: [],
  coherence: {},
  log: [],
  ...overrides,
});

function renderTab(props = {}) {
  const onAddElement = vi.fn();
  const onRejectElements = vi.fn();
  const utils = render(
    <TheorySuggestTab
      state={aState()}
      onAddElement={onAddElement}
      onRejectElements={onRejectElements}
      {...props}
    />,
  );
  return { ...utils, onAddElement, onRejectElements };
}

const suggest = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Suggest/ }));
  });
};

// ─── Gating ───────────────────────────────────────────────────────────────────

describe("gating", () => {
  it("is disabled until a principle exists, and says why", () => {
    // A background theory grounds a principle or puts pressure on one; with no
    // principle there is nothing for it to bear on.
    renderTab({ state: aState({ elements: [] }) });
    const button = screen.getByRole("button", { name: /Suggest/ });
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/at least one principle/i);
  });

  it("does not count a withdrawn principle", () => {
    renderTab({
      state: aState({
        elements: [
          {
            id: "P1",
            type: "principle",
            status: "withdrawn",
            confidence: 0.67,
            text: "gone",
            addedRound: 1,
          },
        ],
      }),
    });
    expect(screen.getByRole("button", { name: /Suggest/ }).disabled).toBe(true);
  });

  it("asks for nothing until the button is pressed", () => {
    renderTab();
    expect(fetchTheorySuggestions).not.toHaveBeenCalled();
  });

  it("does not auto-fetch even when told to, if suggestions are disabled", () => {
    renderTab({ autoFetch: true, suggestionsDisabled: true });
    expect(fetchTheorySuggestions).not.toHaveBeenCalled();
  });

  it("does not auto-fetch when there is no principle to bear on", () => {
    // The workflow can arrive at this phase with nothing here — the reader may
    // have accepted no principle — and the gate that greys the button has to
    // hold the auto-fetch too, or arriving spends a call and a round of
    // Crossref lookups on suggestions the tab has just said it cannot make.
    renderTab({ autoFetch: true, state: aState({ elements: [] }) });
    expect(fetchTheorySuggestions).not.toHaveBeenCalled();
  });

  it("auto-fetches on arrival once a principle is there", async () => {
    await act(async () => {
      renderTab({ autoFetch: true });
    });
    expect(fetchTheorySuggestions).toHaveBeenCalled();
  });
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("the suggestion card", () => {
  it("shows the theory and its references", async () => {
    renderTab();
    await suggest();
    expect(screen.getByText(/made worse off/)).toBeTruthy();
    expect(screen.getByText(/Reasons and persons/)).toBeTruthy();
  });

  it("says nothing about how a theory relates to existing elements", async () => {
    // Which relations hold is the Relations tab's business. Annotating them
    // here would duplicate that tab and put the model's reading of a connection
    // ahead of the user's.
    const { container } = renderTab();
    await suggest();
    expect(container.textContent).not.toMatch(
      /\b(supports|conflicts|undermines|depends)\s+[JPT]\d/,
    );
  });

  it("carries the citation caveat on the disclosure banner", async () => {
    // Two claims, and the second is the one that is easy to lose: the references
    // are AI-generated, and a confirmed one exists without that confirming it
    // says what is claimed here.
    renderTab();
    await suggest();
    const banner = screen.getByText(/References are AI-generated/);
    expect(banner.textContent).toMatch(/A confirmed one exists/);
    expect(banner.textContent).toMatch(/not checked/);
  });

  it("links a confirmed reference to its DOI", async () => {
    renderTab();
    await suggest();
    const link = screen.getByRole("link", { name: /doi\.org/ });
    expect(link.getAttribute("href")).toBe(
      "https://doi.org/10.1093/019824908x.001.0001",
    );
  });

  it("labels an unmatched reference without implying it is invented", async () => {
    // Crossref's coverage of philosophy monographs is patchy, so "not found" is
    // a statement about the index, not about the work. No warning colour either.
    renderTab();
    await suggest();
    const label = screen.getByText(/not found in Crossref/);
    expect(label.getAttribute("title")).toMatch(/does not index every book/i);
    expect(label.textContent).not.toMatch(/suspect|invented|fabricat/i);
  });

  it("renders a sourceless suggestion with no empty heading", async () => {
    // An empty list is a permitted and often preferable answer — requiring a
    // citation per suggestion is how fabricated ones get produced — so it must
    // not be presented as a failure.
    renderTab();
    await suggest();
    expect(screen.getByText(/psychological continuity/)).toBeTruthy();
    // One heading per suggestion that has sources; the third has none.
    expect(screen.getAllByText("Sources")).toHaveLength(2);
  });
});

// ─── Accepting ────────────────────────────────────────────────────────────────

describe("accepting", () => {
  const acceptFirst = () =>
    fireEvent.click(screen.getAllByRole("button", { name: /Accept/ })[0]);

  it("adds a theory element attributed to the model", async () => {
    const { onAddElement } = renderTab();
    await suggest();
    acceptFirst();
    expect(onAddElement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "theory", origin: "test-model" }),
    );
  });

  it("carries the references through, DOI included", async () => {
    const { onAddElement } = renderTab();
    await suggest();
    acceptFirst();
    const [{ sources }] = onAddElement.mock.calls[0];
    expect(sources[0].title).toBe("Reasons and persons");
    expect(sources[0].doi).toBe("10.1093/019824908x.001.0001");
  });

  it("does not persist the verification verdict", async () => {
    // A verdict goes stale as Crossref indexes more; the DOI it yielded does
    // not. A stored reference carrying a DOI is one that verified.
    const { onAddElement } = renderTab();
    await suggest();
    acceptFirst();
    expect(onAddElement.mock.calls[0][0].sources[0]).not.toHaveProperty(
      "verification",
    );
  });

  it("omits the sources key entirely when there are none", async () => {
    const { onAddElement } = renderTab();
    await suggest();
    fireEvent.click(screen.getAllByRole("button", { name: /Accept/ })[2]);
    expect(onAddElement.mock.calls[0][0]).not.toHaveProperty("sources");
  });

  it("removes the card once accepted", async () => {
    renderTab();
    await suggest();
    acceptFirst();
    expect(screen.queryByText(/made worse off/)).toBeNull();
  });
});

// ─── Modifying ────────────────────────────────────────────────────────────────

describe("modifying", () => {
  const modifyFirst = () =>
    fireEvent.click(screen.getAllByRole("button", { name: /Modify/ })[0]);

  // The add-element panel at the foot of the tab has fields of its own, so a
  // bare textbox query would be ambiguous. The edit box is the one holding the
  // suggestion's current wording.
  const editBox = () => screen.getByDisplayValue(/made worse off/);

  it("stamps the origin as model and user when the text was reworded", async () => {
    const { onAddElement } = renderTab();
    await suggest();
    modifyFirst();
    fireEvent.change(editBox(), {
      target: { value: "My own wording." },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Accept/ })[0]);
    const [added] = onAddElement.mock.calls[0];
    expect(added.text).toBe("My own wording.");
    expect(added.origin).toMatch(/test-model.*user/);
  });

  it("lets a reference be removed before accepting", async () => {
    // A rewritten theory can otherwise keep a reference that no longer supports
    // what it now says.
    const { onAddElement } = renderTab();
    await suggest();
    modifyFirst();
    fireEvent.click(screen.getAllByRole("button", { name: /Remove this reference/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Accept/ })[0]);
    expect(onAddElement.mock.calls[0][0]).not.toHaveProperty("sources");
  });

  it("counts removing a reference as a user edit", async () => {
    const { onAddElement } = renderTab();
    await suggest();
    modifyFirst();
    fireEvent.click(screen.getAllByRole("button", { name: /Remove this reference/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Accept/ })[0]);
    expect(onAddElement.mock.calls[0][0].origin).toMatch(/test-model.*user/);
  });

  it("offers no way to edit a reference in place", async () => {
    // Deliberate: editing invites correcting a fabricated citation into a
    // plausible one. Removal is the only operation offered.
    renderTab();
    await suggest();
    modifyFirst();
    expect(screen.queryByDisplayValue(/Reasons and persons/)).toBeNull();
  });

  it("restores the original on cancel", async () => {
    renderTab();
    await suggest();
    modifyFirst();
    fireEvent.change(editBox(), { target: { value: "scratch" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Cancel/ })[0]);
    expect(screen.getByText(/made worse off/)).toBeTruthy();
  });
});

// ─── Rejecting ────────────────────────────────────────────────────────────────

describe("rejecting", () => {
  it("records the theory as rejected and clears the card", async () => {
    const { onRejectElements } = renderTab();
    await suggest();
    fireEvent.click(screen.getAllByRole("button", { name: /Reject/ })[0]);
    expect(onRejectElements).toHaveBeenCalledWith([
      expect.objectContaining({ type: "theory" }),
    ]);
    expect(screen.queryByText(/made worse off/)).toBeNull();
  });
});
