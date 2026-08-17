// @vitest-environment jsdom
//
// The wide bar and the narrow menu are two views of one set of sub-tabs. When
// they disagree, the loser is whoever is on a phone: the panels are gated on
// the same flags the header filters by, so a tab offered by only one layout
// drops the user on a view that renders nothing and says nothing about why.
// These tests hold the two layouts to the same set.
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
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
import { TOUR_Z } from "./TutorialStepper.jsx";

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
  tourActive: false,
  onStartTour: noop,
  onCloseTour: noop,
  hideTabBar: false,
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

describe("what closes the menu", () => {
  // A setting flips in place, and its switch is the only evidence of it.
  // Closing the menu fired the change and then hid that evidence.
  const openMenu = () => fireEvent.click(screen.getAllByText("☰")[0]);
  // Select Font lives inside the menu in both layouts and nowhere else.
  const menuIsOpen = () => screen.queryByText("Select Font") !== null;

  // Named the same in both layouts: the labels come from one module.
  const SETTINGS = [
    "Section nav bar",
    "Expanded cards",
    "All relations",
    "Dark mode",
    "High-contrast",
  ];

  beforeEach(() => {
    // useTheme reads this on mount, so the theme row starts from a known state.
    document.documentElement.removeAttribute("data-theme");
  });

  for (const isWide of [true, false]) {
    const layout = isWide ? "wide" : "narrow";

    for (const label of SETTINGS) {
      it(`stays open for "${label}" (${layout})`, () => {
        render(<AppHeader {...PROPS} isWide={isWide} />);
        openMenu();
        expect(menuIsOpen()).toBe(true);

        fireEvent.click(screen.getByText(label));
        expect(menuIsOpen()).toBe(true);
      });
    }

    it(`still closes on the way somewhere else (${layout})`, () => {
      render(<AppHeader {...PROPS} isWide={isWide} />);
      openMenu();
      fireEvent.click(screen.getByText("Home"));
      expect(menuIsOpen()).toBe(false);
    });
  }

  it("closes when the narrow menu is used to switch tabs", () => {
    render(<AppHeader {...PROPS} isWide={false} />);
    openMenu();
    fireEvent.click(screen.getByText(TAB_LABELS.history));
    expect(menuIsOpen()).toBe(false);
  });
});

describe("how a setting reports its state", () => {
  // The rows used to flip their own wording, which left it ambiguous whether a
  // row named the state in force or the change on offer — and the two menus did
  // not even agree with each other. The label is fixed now and the state is on
  // aria-pressed, drawn as the switch beside it.
  const openMenu = () => fireEvent.click(screen.getAllByText("☰")[0]);

  /** Label → the props that put the setting on, and those that put it off. */
  const TOGGLES = {
    "All relations": [
      { hideNonEntailsRels: false },
      { hideNonEntailsRels: true },
    ],
    "Section nav bar": [{ showTabNav: true }, { showTabNav: false }],
    "Expanded cards": [{ allExpanded: true }, { allExpanded: false }],
  };

  for (const isWide of [true, false]) {
    const layout = isWide ? "wide" : "narrow";

    for (const [label, [on, off]] of Object.entries(TOGGLES)) {
      it(`keeps "${label}" named the same either way (${layout})`, () => {
        for (const [props, pressed] of [
          [on, "true"],
          [off, "false"],
        ]) {
          render(<AppHeader {...PROPS} {...props} isWide={isWide} />);
          openMenu();
          expect(screen.getByText(label).getAttribute("aria-pressed")).toBe(
            pressed,
          );
          cleanup();
        }
      });
    }
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

describe("the guided tour", () => {
  // Which tour runs is a property of the width, and the header only owns one of
  // them. The phone's card stack is mounted here, next to the ☰ menu it walks;
  // the wide tour drives the graph's selection and framing, so REState mounts
  // that one and both of them run off the `tourActive` it holds.
  const welcome = () => screen.queryByText(/Welcome to Reflective APPilibrium/);

  it("asks the app to start the tour rather than starting one itself", () => {
    const onStartTour = vi.fn();
    render(<AppHeader {...PROPS} onStartTour={onStartTour} isWide />);

    fireEvent.click(screen.getByLabelText("Start the step-by-step tour"));
    expect(onStartTour).toHaveBeenCalled();
    expect(welcome()).toBeNull();
  });

  it("can be started from the narrow menu", () => {
    const onStartTour = vi.fn();
    render(<AppHeader {...PROPS} onStartTour={onStartTour} isWide={false} />);

    fireEvent.click(screen.getAllByText("☰")[0]);
    fireEvent.click(screen.getByText("Guided tour"));
    expect(onStartTour).toHaveBeenCalled();
  });

  it("shows the phone's card stack while the tour runs, but never on a wide screen", () => {
    render(<AppHeader {...PROPS} tourActive isWide={false} />);
    expect(welcome()).not.toBeNull();
    cleanup();

    // The wide tour is a scrolling page mounted by REState. Rendering the phone
    // cards here too would put two tours on screen at once.
    render(<AppHeader {...PROPS} tourActive isWide />);
    expect(welcome()).toBeNull();
  });

  it("opens the narrow menu itself once the tour gets that far", () => {
    render(<AppHeader {...PROPS} tourActive isWide={false} />);
    // The tour opens the menu when it reaches the steps that walk it, not before.
    expect(document.querySelector('[data-tutorial="menu-assist"]')).toBeNull();

    // welcome → the graph → the ☰ button → the first section inside it
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText("Next →"));

    expect(screen.getByText(/Assist — the RE cycle/)).toBeTruthy();
    const section = document.querySelector('[data-tutorial="menu-assist"]');
    expect(section).not.toBeNull();
    // Lifted over the tour's dim, or the section being described reads as
    // greyed out as everything else.
    expect(section.closest('[style*="position: absolute"]').style.zIndex).toBe(
      String(TOUR_Z.menu),
    );
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
      "Section nav bar",
      "Expanded cards",
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
      labels: ["graph", "history", "clusters"],
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
