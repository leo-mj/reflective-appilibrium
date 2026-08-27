// @vitest-environment jsdom
//
// The bar carries section pills and a search box. On a phone the pills wrap
// onto a second row and leave the search a stub in the corner, so at that width
// the search takes the bar to itself.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";

import { NavBar } from "./TextTabNavBar.jsx";

afterEach(cleanup);

const ITEMS = [
  { key: "judgments", label: "J", name: "judgments", count: 14 },
  { key: "principles", label: "P", name: "principles", count: 6 },
  { key: "clusters", label: "Clusters", count: 4 },
];

const renderBar = (props = {}) =>
  render(
    <NavBar
      navItems={ITEMS}
      activeSection="judgments"
      isCollapsed={() => false}
      search=""
      onSearch={() => {}}
      onNavigate={() => {}}
      {...props}
    />,
  );

const pills = (container) => [...container.querySelectorAll("button")];
const searchBox = (container) => container.querySelector('input[type="search"]');

describe("when wide", () => {
  it("offers a pill per section", () => {
    const { container } = renderBar({ isWide: true });
    expect(pills(container).map((b) => b.textContent)).toEqual([
      "J (14)",
      "P (6)",
      "Clusters (4)",
    ]);
  });

  it("leaves room for them beside the search", () => {
    const { container } = renderBar({ isWide: true });
    expect(searchBox(container).style.width).toBe("30%");
  });
});

describe("when narrow", () => {
  it("drops the pills", () => {
    const { container } = renderBar({ isWide: false });
    expect(pills(container)).toHaveLength(0);
  });

  it("gives the whole bar to the search", () => {
    const { container } = renderBar({ isWide: false });
    const box = searchBox(container);
    expect(box.style.width).toBe("100%");
    // marginLeft: auto would push it off the full width it was just given.
    expect(box.style.marginLeft).toBe("");
  });

  it("still searches", () => {
    const onSearch = vi.fn();
    const { container } = renderBar({ isWide: false, onSearch });
    fireEvent.change(searchBox(container), { target: { value: "torture" } });
    expect(onSearch).toHaveBeenCalledWith("torture");
  });
});

describe("pill tooltips", () => {
  // A pill reading "J" says nothing on its own; the tooltip is what tells you
  // where it goes before you click it.
  it("spells out the section a letter stands for", async () => {
    vi.useFakeTimers();
    const { container } = renderBar({ isWide: true });
    fireEvent.mouseEnter(pills(container)[0]);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(document.body.textContent).toContain("Jump to Judgments");
    vi.useRealTimers();
  });

  it("falls back to the label when no long name is given", async () => {
    vi.useFakeTimers();
    const { container } = renderBar({ isWide: true });
    fireEvent.mouseEnter(pills(container)[2]);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(document.body.textContent).toContain("Jump to Clusters");
    vi.useRealTimers();
  });
});

it("renders nothing when there are no sections", () => {
  const { container } = renderBar({ navItems: [] });
  expect(container.textContent).toBe("");
});
