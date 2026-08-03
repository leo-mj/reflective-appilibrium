// @vitest-environment jsdom
//
// Which section the nav bar highlights. The previous implementation observed a
// fixed set of elements chosen when its effect last ran, and only ever set the
// active section — never cleared it. A section that mounted later (the
// arguments section appears only once all relations are shown, and relations
// are hidden by default) was therefore never observed, and the bar went on
// pointing at whichever section it had last managed to see.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useRef, useState } from "react";

import { useActiveSection } from "./useActiveSection.js";

afterEach(cleanup);

/**
 * Renders the hook over a set of section elements at given vertical offsets.
 * jsdom does no layout, so `getBoundingClientRect` is stubbed per element.
 *
 * `tops` is read at measure time, not captured, so a test can move a section
 * and scroll to it. React reattaches the inline ref callback on every render,
 * which would otherwise restore the offset the section started at.
 *
 * @param {Object<string, number|null>} tops - key → top offset, or null when
 *   that section is not mounted at all.
 */
function harness(tops) {
  function Probe() {
    const scrollRef = useRef(null);
    // One stable ref object per section, exactly as TextTab holds them.
    const [refs] = useState(() =>
      Object.fromEntries(Object.keys(tops).map((k) => [k, { current: null }])),
    );
    const active = useActiveSection(refs, scrollRef);
    return (
      <div ref={scrollRef} data-active={active ?? ""}>
        {Object.entries(tops).map(([key, top]) =>
          top === null ? null : (
            <div
              key={key}
              ref={(node) => {
                refs[key].current = node;
                if (node) node.getBoundingClientRect = () => ({ top: tops[key] });
              }}
            />
          ),
        )}
      </div>
    );
  }

  let n = 0;
  const utils = render(<Probe n={n} />);
  // The container itself sits at 0, so the threshold line is at +12.
  utils.container.firstChild.getBoundingClientRect = () => ({ top: 0 });
  // A fresh prop each time, so React cannot bail out of the re-render.
  const update = () => act(() => utils.rerender(<Probe n={++n} />));
  /** The section the hook currently reports. */
  const active = () => utils.container.firstChild.getAttribute("data-active");
  return { active, utils, update };
}

describe("useActiveSection", () => {
  it("names the last section whose top has passed the line", () => {
    const { active } = harness({
      judgments: -500,
      principles: -200,
      theories: 5,
      clusters: 400,
    });
    // theories starts at 5, above the 12px line; clusters has not arrived.
    expect(active()).toBe("theories");
  });

  it("does not skip past a section that mounted later", () => {
    // The exact reported failure: arguments appears only once all relations
    // are shown, so it was absent when an observer would have been built.
    const tops = { judgments: -900, arguments: null, clusters: 300 };
    const { active, update } = harness(tops);
    expect(active()).toBe("judgments");

    // "All relations" is switched on, mounting the arguments section.
    tops.arguments = -100;
    update();

    expect(active()).toBe("arguments");
  });

  it("falls back to the first mounted section above the line", () => {
    // Scrolled to the very top: the round banner and add bar sit above the
    // first section, so nothing has passed the line yet.
    const { active } = harness({ judgments: 80, principles: 300 });
    expect(active()).toBe("judgments");
  });

  it("ignores a section key with nothing mounted", () => {
    const { active } = harness({
      judgments: -400,
      coherence: null,
      clusters: 900,
    });
    expect(active()).toBe("judgments");
  });

  it("re-measures when the container scrolls", () => {
    const tops = { judgments: -100, clusters: 500 };
    const { active, utils } = harness(tops);
    expect(active()).toBe("judgments");

    // Simulate scrolling down: clusters rises above the line.
    const container = utils.container.firstChild;
    tops.clusters = -50;

    const raf = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb();
        return 1;
      });
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });
    raf.mockRestore();

    expect(active()).toBe("clusters");
  });
});
