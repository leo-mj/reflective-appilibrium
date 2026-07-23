// @vitest-environment jsdom
//
// Renders the real JudgmentElicitTab component and checks whether the
// autoFetch useEffect guard fires correctly. The client function is mocked
// so we can assert whether it was called without hitting the network.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

// vi.mock is hoisted above all imports, so the spy must be created inside
// the factory using only vi.fn() — no outer variables are in scope yet.
// We retrieve the reference by importing the mocked module below.
vi.mock("../../utils/judgmentsClient.js", () => ({
  fetchJudgmentElicitations: vi.fn().mockResolvedValue({
    suggestions: [],
    model: "sample data model",
  }),
}));

import { JudgmentElicitTab } from "./JudgmentElicitTab.jsx";
import { fetchJudgmentElicitations } from "../../utils/judgmentsClient.js";

const baseProps = {
  state: {
    elements: [],
    topic: "",
    round: 1,
    relations: [],
    coherence: {},
    log: [],
  },
  onAddElement: () => {},
  onRejectElements: () => {},
  workflowPhase: null,
  onAdvanceWorkflow: () => {},
  nextPhaseIsEnabled: false,
  useDummy: false,
};

afterEach(() => vi.clearAllMocks());

describe("JudgmentElicitTab autoFetch guard", () => {
  it("does not fetch when suggestionsDisabled=true (prod + new RE process)", async () => {
    await act(async () => {
      render(
        <JudgmentElicitTab
          {...baseProps}
          autoFetch={true}
          suggestionsDisabled={true}
        />,
      );
    });

    expect(fetchJudgmentElicitations).not.toHaveBeenCalled();
  });

  it("fetches when autoFetch=true and suggestionsDisabled=false (prod + sample)", async () => {
    await act(async () => {
      render(
        <JudgmentElicitTab
          {...baseProps}
          autoFetch={true}
          suggestionsDisabled={false}
        />,
      );
    });

    expect(fetchJudgmentElicitations).toHaveBeenCalledOnce();
  });

  it("does not fetch when autoFetch=false regardless of suggestionsDisabled", async () => {
    await act(async () => {
      render(
        <JudgmentElicitTab
          {...baseProps}
          autoFetch={false}
          suggestionsDisabled={false}
        />,
      );
    });

    expect(fetchJudgmentElicitations).not.toHaveBeenCalled();
  });
});
