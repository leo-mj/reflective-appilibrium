// A disabled control that says nothing is a dead end: the user has no way to
// tell whether they are missing a prerequisite they could satisfy or hitting a
// wall this build cannot get past.
import { describe, it, expect } from "vitest";

import { suggestionsUnavailable } from "./disabledReason.js";

describe("suggestionsUnavailable", () => {
  it("says nothing when the control is live", () => {
    expect(suggestionsUnavailable({})).toBeUndefined();
    expect(suggestionsUnavailable()).toBeUndefined();
  });

  it("names the backend as the reason, and points at the sample", () => {
    const why = suggestionsUnavailable({ noBackend: true });
    expect(why).toContain("backend");
    expect(why).toContain("sample");
  });

  it("gives an unmet precondition as something to do", () => {
    expect(suggestionsUnavailable({ needs: "Add at least two elements first." })).toBe(
      "Add at least two elements first.",
    );
  });

  it("reports the request in flight ahead of anything else", () => {
    // Nothing else is actionable while one is running, and it clears itself.
    expect(
      suggestionsUnavailable({ loading: true, noBackend: true, needs: "Add more." }),
    ).toContain("Working");
  });

  it("prefers the backend over a precondition the user cannot act on anyway", () => {
    expect(
      suggestionsUnavailable({ noBackend: true, needs: "Add more." }),
    ).toContain("backend");
  });
});
