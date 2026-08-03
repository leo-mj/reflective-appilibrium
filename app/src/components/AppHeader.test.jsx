// @vitest-environment jsdom
//
// The wide bar and the narrow menu are two views of one set of sub-tabs. When
// they disagree, the loser is whoever is on a phone: the panels are gated on
// the same flags the header filters by, so a tab offered by only one layout
// drops the user on a view that renders nothing and says nothing about why.
// These tests hold the two layouts to the same set.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Read through a getter so a test can flip the backend on without reloading the
// module graph — re-importing would give this file a second copy of React.
const flags = vi.hoisted(() => ({ backend: false }));
vi.mock("../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKEND_ENABLED() {
    return flags.backend;
  },
}));

import { AppHeader } from "./AppHeader.jsx";
import { TAB_LABELS } from "../constants/tabConstants.jsx";

afterEach(() => {
  cleanup();
  flags.backend = false;
});

const noop = () => {};

const PROPS = {
  round: 3,
  topic: "obligations to future generations",
  model: undefined,
  tab: "graph",
  setTab: noop,
  assistSidePanel: "graph",
  setAssistSidePanel: noop,
  onDownload: noop,
  onSave: noop,
  onImportFile: noop,
  hasExistingState: false,
  onHome: noop,
  isWide: true,
  workflowPhase: null,
  workflowLoops: 0,
  onStartWorkflow: noop,
  onStopWorkflow: noop,
  onUndo: noop,
  canUndo: false,
  showTabNav: false,
  setShowTabNav: noop,
  allExpanded: true,
  onExpandAll: noop,
  hideNonEntailsRels: false,
  setHideNonEntailsRels: noop,
  verifyArguments: false,
  setVerifyArguments: noop,
  weights: { account: 0.35, systematicity: 0.55, faithfulness: 0.1 },
  weightsChanged: false,
  onWeightsChange: noop,
  onResetWeights: noop,
};

/** Tab labels offered by the narrow layout, with the menu opened. */
const narrowTabs = (overrides = {}) => {
  render(<AppHeader {...PROPS} {...overrides} isWide={false} />);
  fireEvent.click(screen.getByText("☰"));
  return offered();
};

/** Tab labels offered by the wide layout for the group `tab` belongs to. */
const wideTabs = (overrides = {}) => {
  render(<AppHeader {...PROPS} {...overrides} isWide />);
  return offered();
};

/** Every rendered button whose text is a known tab label. */
const offered = () => {
  const known = new Set(Object.values(TAB_LABELS));
  return [...document.querySelectorAll("button")]
    .map((b) => b.textContent.trim())
    .filter((t) => known.has(t));
};

describe("narrow menu tab filtering", () => {
  // MATRIX_ENABLED is false, and GraphPanel gates the matrix panel on the same
  // flag, so offering the tab here led straight to an empty view.
  it("omits matrix while the feature is off", () => {
    expect(narrowTabs()).not.toContain(TAB_LABELS.matrix);
  });

  it("omits the questionnaire outside questionnaire mode", () => {
    expect(narrowTabs()).not.toContain(TAB_LABELS.questionnaire);
  });

  it("offers the questionnaire in questionnaire mode", () => {
    expect(
      narrowTabs({ model: "questionnaire", tab: "questionnaire" }),
    ).toContain(TAB_LABELS.questionnaire);
  });

  it("omits relation suggestions when non-entails relations are hidden", () => {
    expect(narrowTabs()).toContain(TAB_LABELS.suggestRelations);
    cleanup();
    expect(narrowTabs({ hideNonEntailsRels: true })).not.toContain(
      TAB_LABELS.suggestRelations,
    );
  });
});

describe("model weights", () => {
  // The weights only steer the rethon simulation, which needs the backend. With
  // no backend they are a control that cannot affect anything the user sees.
  const openMenu = () => fireEvent.click(screen.getAllByText("☰")[0]);

  for (const isWide of [true, false]) {
    const layout = isWide ? "wide" : "narrow";

    it(`stays out of the ${layout} menu without a backend`, () => {
      render(<AppHeader {...PROPS} isWide={isWide} />);
      openMenu();
      expect(screen.queryByText(/Model weights/)).toBeNull();
    });

    it(`is offered in the ${layout} menu when there is a backend`, () => {
      flags.backend = true;
      render(<AppHeader {...PROPS} isWide={isWide} />);
      openMenu();
      expect(screen.queryByText(/Model weights/)).not.toBeNull();
    });
  }
});

describe("the narrow text button", () => {
  // At this width the text panel is a tab (`tab === "text"` in REState), not
  // the side panel the wide layout shows and hides. The menu used to offer the
  // wide layout's Hide/Show toggle here, which flipped its own label and
  // changed nothing else.
  const openMenu = () => fireEvent.click(screen.getAllByText("☰")[0]);

  it("switches to the text tab", () => {
    const setTab = vi.fn();
    render(<AppHeader {...PROPS} isWide={false} setTab={setTab} />);
    openMenu();

    fireEvent.click(screen.getByText("Text"));
    expect(setTab).toHaveBeenCalledWith("text");
  });

  it("reads the same whichever tab is open", () => {
    for (const tab of ["graph", "text", "elicitJudgments"]) {
      render(<AppHeader {...PROPS} isWide={false} tab={tab} />);
      openMenu();
      expect(screen.getByText("Text")).toBeTruthy();
      cleanup();
    }
  });

  it("sits directly above the graph button", () => {
    render(<AppHeader {...PROPS} isWide={false} />);
    openMenu();

    // The button carries a leading icon glyph, so match on the trailing label.
    const labels = [...document.querySelectorAll("button")].map((b) =>
      b.textContent.trim(),
    );
    const text = labels.findIndex((l) => l.endsWith("Text"));
    expect(text).toBeGreaterThan(-1);
    expect(labels.indexOf(TAB_LABELS.graph)).toBe(text + 1);
  });
});

describe("LLM settings", () => {
  // Unlike the model weights, this one stays reachable without a backend: the
  // modal explains what BYOK would involve, with its live controls disabled.
  const openMenu = () => fireEvent.click(screen.getAllByText("☰")[0]);

  for (const isWide of [true, false]) {
    it(`is offered in the ${isWide ? "wide" : "narrow"} menu without a backend`, () => {
      render(<AppHeader {...PROPS} isWide={isWide} />);
      openMenu();
      expect(screen.queryByText(/LLM settings/)).not.toBeNull();
    });
  }
});

describe("narrow menu order", () => {
  // The menu is the only navigation at this width, so moving between views is
  // what it is mostly opened for. Settings and one-off actions come after.
  const openMenu = () => fireEvent.click(screen.getAllByText("☰")[0]);

  it("puts the tab groups under Home, ahead of everything else", () => {
    render(<AppHeader {...PROPS} isWide={false} />);
    openMenu();

    const labels = [...document.querySelectorAll("button")].map((b) =>
      b.textContent.trim(),
    );
    const idx = (needle) => labels.findIndex((l) => l.includes(needle));

    expect(idx("Home")).toBeGreaterThan(-1);
    for (const t of ["elicitJudgments", "graph", "clusters"]) {
      expect(idx(TAB_LABELS[t])).toBeGreaterThan(idx("Home"));
    }
    for (const later of [
      "nav bar",
      "toggles",
      "Select Font",
      "Import",
      "Export",
    ]) {
      expect(idx(later)).toBeGreaterThan(idx(TAB_LABELS.clusters));
    }
  });
});

describe("narrow menu alignment", () => {
  // Rows used to carry their symbol three different ways — a bare glyph and a
  // space, a 20px box, or a 24px icon — so the labels started at three
  // different offsets down a single column.
  const openMenu = () => fireEvent.click(screen.getAllByText("☰")[0]);

  it("opens every row with the same icon box", () => {
    render(<AppHeader {...PROPS} isWide={false} />);
    openMenu();

    const rows = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent.trim() !== "☰",
    );
    expect(rows.length).toBeGreaterThan(8);

    for (const row of rows) {
      expect(
        row.firstElementChild?.style.width,
        `"${row.textContent.trim()}" should lead with the shared icon box`,
      ).toBe("20px");
    }
  });
});

describe("the two layouts agree", () => {
  // Compared per group, because the wide bar only ever shows the group the
  // current tab belongs to while the narrow menu lists them all at once.
  const groupOf = {
    analyze: {
      tab: "graph",
      labels: ["graph", "history", "clusters", "matrix"],
    },
    assist: {
      tab: "elicitJudgments",
      labels: [
        "questionnaire",
        "elicitJudgments",
        "suggestPrinciples",
        "detectArguments",
        "suggestRelations",
      ],
    },
  };

  for (const [name, { tab, labels }] of Object.entries(groupOf)) {
    for (const overrides of [
      {},
      { hideNonEntailsRels: true },
      { model: "questionnaire" },
    ]) {
      it(`on the ${name} tabs for ${JSON.stringify(overrides)}`, () => {
        const inGroup = (offering) =>
          offering.filter((t) => labels.some((l) => TAB_LABELS[l] === t));

        const wide = inGroup(wideTabs({ ...overrides, tab }));
        cleanup();
        const narrow = inGroup(narrowTabs({ ...overrides, tab }));

        expect(narrow).toEqual(wide);
      });
    }
  }
});
