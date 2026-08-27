// @vitest-environment jsdom
//
// Tensions, orphans and clusters are all answers to how the commitments hang
// together, so they are one section. They used to be two, which asked the
// reader to know that a cluster is a coherence finding before they could think
// to look for one.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { Ctx } from "./TextTabContext.js";
import { CoherenceSection } from "./CoherenceSection.jsx";

afterEach(cleanup);

const STATE = {
  round: 2,
  elements: [
    { id: "J1", type: "judgment", status: "active", confidence: 1, text: "Torturing is wrong.", addedRound: 1 },
    { id: "P1", type: "principle", status: "active", confidence: 1, text: "Do no harm.", addedRound: 1 },
  ],
  relations: [],
};

const COHERENCE = {
  tensions: ["J1 conflicts with P1"],
  orphans: [],
  possibleSupport: [],
};

const CLUSTERS = [{ members: new Set(["J1", "P1"]), size: 2 }];

function setup({ coherence = COHERENCE, clusters = CLUSTERS } = {}) {
  return render(
    <Ctx.Provider
      value={{
        state: STATE,
        selected: null,
        onSelect: () => {},
        badgeColor: () => "#888",
        badgeFill: () => "#444",
        badgeTextColor: () => "#888",
        search: "",
        isWide: true,
      }}
    >
      <CoherenceSection
        coherence={coherence}
        state={STATE}
        clusters={clusters}
        sectionRef={{ current: null }}
        isCollapsed={false}
        onToggle={() => {}}
      />
    </Ctx.Provider>,
  );
}

describe("the coherence section", () => {
  it("reads out the findings and the clusters under one heading", () => {
    const { container } = setup();
    expect(container.textContent).toContain("Coherence");
    expect(container.textContent).toContain("Tensions");
    expect(container.textContent).toContain("J1 conflicts with P1");
    expect(container.textContent).toContain("Clusters (1)");
    expect(container.textContent).toContain("Cluster 1");
  });

  it("has one collapsible heading, not one per kind of finding", () => {
    const { container } = setup();
    const headings = [...container.querySelectorAll("div")].filter(
      (d) => d.style.position === "sticky",
    );
    expect(headings).toHaveLength(1);
  });

  it("still reads out the findings when there are no clusters", () => {
    const { container } = setup({ clusters: [] });
    expect(container.textContent).toContain("J1 conflicts with P1");
    expect(container.textContent).not.toContain("Clusters (");
  });

  it("still reads out the clusters when there is nothing else to report", () => {
    const { container } = setup({
      coherence: { tensions: [], orphans: [], possibleSupport: [] },
    });
    expect(container.textContent).toContain("Clusters (1)");
  });
});
