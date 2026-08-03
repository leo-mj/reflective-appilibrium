// The three presets are ordinal categories, not measurements. Printing "0.33"
// for Low states a precision nobody expressed and invites reading 0.33 and 0.34
// as a meaningful difference, when only one of them is reachable by the UI.
import { describe, it, expect } from "vitest";

import { confidenceLabel, confidenceDetail } from "./confidenceLabel.js";

describe("confidenceLabel", () => {
  it("names each preset rather than printing its value", () => {
    expect(confidenceLabel(0.33).text).toBe("Low");
    expect(confidenceLabel(0.67).text).toBe("Moderate");
    expect(confidenceLabel(1.0).text).toBe("High");
  });

  it("keeps the number reachable, since it still feeds the weights", () => {
    expect(confidenceLabel(0.67).title).toBe("0.67");
  });

  it("leaves a typed value as a number, which is what it is", () => {
    expect(confidenceLabel(0.42)).toEqual({ text: "0.42", title: undefined });
  });

  it("does not round a near miss into a preset", () => {
    // 0.5 is closer to Moderate than to Low, but the user typed it deliberately.
    expect(confidenceLabel(0.5).text).toBe("0.50");
  });

  it("survives the values a hand-written state can carry", () => {
    expect(confidenceLabel(undefined).text).toBe("");
    expect(confidenceLabel(null).text).toBe("");
    expect(confidenceLabel("high").text).toBe("high");
    expect(confidenceLabel(NaN).text).toBe("NaN");
  });
});

describe("confidenceDetail", () => {
  it("shows both, for surfaces that are already a tooltip", () => {
    expect(confidenceDetail(0.67)).toBe("Moderate (0.67)");
  });

  it("does not repeat a typed value twice over", () => {
    expect(confidenceDetail(0.42)).toBe("0.42");
  });
});
