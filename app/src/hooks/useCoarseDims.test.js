// @vitest-environment jsdom
//
// The hook exists so a phone's URL bar collapsing does not restart the force
// simulation. These pin down both halves of that: small changes are swallowed,
// and a change big enough to matter — a rotation, a panel opening — still gets
// through. See useCoarseDims.js for why a debounce would not do.
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";

import { useCoarseDims } from "./useCoarseDims.js";

afterEach(cleanup);

describe("useCoarseDims", () => {
  it("reports the first dimensions it is given", () => {
    const { result } = renderHook(() => useCoarseDims({ w: 800, h: 600 }));
    expect(result.current).toEqual({ w: 800, h: 600 });
  });

  it("swallows a change smaller than the threshold", () => {
    const { result, rerender } = renderHook((dims) => useCoarseDims(dims), {
      initialProps: { w: 390, h: 675 },
    });

    // A URL bar collapsing takes about 80px off the viewport height.
    rerender({ w: 390, h: 611 });

    expect(result.current).toEqual({ w: 390, h: 675 });
  });

  it("swallows a run of small changes rather than accumulating them", () => {
    const { result, rerender } = renderHook((dims) => useCoarseDims(dims), {
      initialProps: { w: 390, h: 675 },
    });

    // Each step is under the threshold, but so is the distance from the value
    // being reported — which is what the comparison is against, so none land.
    rerender({ w: 390, h: 600 });
    rerender({ w: 390, h: 500 });
    rerender({ w: 390, h: 420 });

    expect(result.current).toEqual({ w: 390, h: 675 });
  });

  it("lets a change past the threshold through, on either side", () => {
    const { result, rerender } = renderHook((dims) => useCoarseDims(dims), {
      initialProps: { w: 390, h: 675 },
    });

    // Rotating a phone: the width change alone clears the threshold.
    rerender({ w: 844, h: 312 });
    expect(result.current).toEqual({ w: 844, h: 312 });

    // Opening a panel beside the graph halves the height it has to work with.
    rerender({ w: 844, h: 900 });
    expect(result.current).toEqual({ w: 844, h: 900 });
  });

  it("measures against the reported size, not the last one passed", () => {
    const { result, rerender } = renderHook((dims) => useCoarseDims(dims), {
      initialProps: { w: 800, h: 600 },
    });

    rerender({ w: 800, h: 350 }); // 250 — swallowed
    rerender({ w: 800, h: 340 }); // 10 from the last, but 260 from 600
    expect(result.current).toEqual({ w: 800, h: 600 });

    rerender({ w: 800, h: 290 }); // 310 from 600 — through
    expect(result.current).toEqual({ w: 800, h: 290 });
  });

  it("honours a threshold of its caller's choosing", () => {
    const { result, rerender } = renderHook((dims) => useCoarseDims(dims, 10), {
      initialProps: { w: 800, h: 600 },
    });

    rerender({ w: 800, h: 595 });
    expect(result.current).toEqual({ w: 800, h: 600 });

    rerender({ w: 800, h: 580 });
    expect(result.current).toEqual({ w: 800, h: 580 });
  });
});
