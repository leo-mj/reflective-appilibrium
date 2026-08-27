// @vitest-environment jsdom
//
// Tooltip reads the trigger's geometry from the event rather than from a ref on
// the cloned child. These tests pin that down: the rect must come from the
// hovered node, the child's own handlers must survive cloning, and a trigger
// that unmounts mid-delay must not be measured.
//
// The touch half is its own problem. A touchscreen has no hover, so the tooltip
// is opened by a long press — which then has to eat the click it ends with, and
// has to tell a real mouse apart from the compatibility mouseenter a tap emits
// once the finger is already gone.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";

import { Tooltip } from "./Tooltip.jsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Advances past the default 400ms hover delay. */
function waitOutDelay(ms = 400) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** The portalled tooltip body, or null when not shown. */
function tooltipNode(text) {
  return [...document.body.querySelectorAll("div")].find(
    (d) => d.textContent === text && d.style.position === "fixed",
  );
}

describe("Tooltip", () => {
  it("returns the child untouched when there is no text", () => {
    const { container } = render(
      <Tooltip text="">
        <button>Go</button>
      </Tooltip>,
    );
    expect(container.querySelector("button").textContent).toBe("Go");
    expect(tooltipNode("")).toBeUndefined();
  });

  describe("what it names the trigger", () => {
    // The tooltip is the name an icon-only button is missing, and the wrong
    // name for one that already says what it is. A row of the ☰ menu is the
    // second kind even though its label arrives beside an icon.
    const nameOf = (children, props = {}) => {
      const { container } = render(
        <Tooltip text="Write the process out to a file.">
          <button {...props}>{children}</button>
        </Tooltip>,
      );
      return container.querySelector("button").getAttribute("aria-label");
    };

    it("names a button that shows only an icon", () => {
      expect(nameOf(<svg />)).toBe("Write the process out to a file.");
    });

    it("leaves a button with a visible label alone", () => {
      expect(nameOf("Export")).toBeNull();
      expect(nameOf([<span key="i">↓</span>, "Export"])).toBeNull();
    });

    it("never overrides a name the trigger brought itself", () => {
      expect(nameOf(<svg />, { "aria-label": "Export" })).toBe("Export");
    });
  });

  it("shows nothing until the delay has elapsed", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    fireEvent.mouseOver(container.querySelector("button"));

    waitOutDelay(399);
    expect(tooltipNode("Accept")).toBeUndefined();

    waitOutDelay(1);
    expect(tooltipNode("Accept")).toBeDefined();
  });

  it("positions the tooltip from the hovered node's rect", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");
    // jsdom reports a zero rect, so supply the geometry the component reads.
    btn.getBoundingClientRect = () => ({
      bottom: 100,
      left: 200,
      width: 40,
    });

    fireEvent.mouseOver(btn);
    waitOutDelay();

    const tip = tooltipNode("Accept");
    expect(tip.style.top).toBe("106px"); // bottom + 6
    // Centred by transform, and laid out from the left edge of the window: a
    // fixed box positioned with `left` gets only what is left of the window to
    // its right, which squeezed every tooltip opened near the right edge into a
    // column one word wide.
    expect(tip.style.left).toBe("0px");
    expect(tip.style.transform).toBe("translateX(220px) translateX(-50%)");
  });

  it("keeps clear of either edge of the window", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");
    // A trigger hard against the right edge — the ☰ menu's rows, every time.
    btn.getBoundingClientRect = () => ({
      bottom: 100,
      left: window.innerWidth - 20,
      width: 20,
    });

    fireEvent.mouseOver(btn);
    waitOutDelay();

    // Half the widest the box may get, and a margin: it ends just short of the
    // edge rather than past it.
    expect(tooltipNode("Accept").style.transform).toBe(
      `translateX(${window.innerWidth - 138}px) translateX(-50%)`,
    );
  });

  it("hides again on mouse leave", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.mouseOver(btn);
    waitOutDelay();
    expect(tooltipNode("Accept")).toBeDefined();

    fireEvent.mouseOut(btn);
    expect(tooltipNode("Accept")).toBeUndefined();
  });

  it("leaves the hover delay unstarted if the pointer leaves first", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.mouseOver(btn);
    waitOutDelay(200);
    fireEvent.mouseOut(btn);
    waitOutDelay(400);

    expect(tooltipNode("Accept")).toBeUndefined();
  });

  it("still calls the child's own mouse handlers", () => {
    vi.useFakeTimers();
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const { container } = render(
      <Tooltip text="Accept">
        <button onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
          Go
        </button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.mouseOver(btn);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);

    fireEvent.mouseOut(btn);
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });

  it("opens on a long press, and closes when the finger lifts", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.pointerDown(btn, { pointerType: "touch" });
    waitOutDelay(499);
    expect(tooltipNode("Accept")).toBeUndefined();

    waitOutDelay(1);
    expect(tooltipNode("Accept")).toBeDefined();

    fireEvent.pointerUp(btn, { pointerType: "touch" });
    expect(tooltipNode("Accept")).toBeUndefined();
  });

  it("swallows the click that ends a long press, but only that one", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const { container } = render(
      <Tooltip text="Accept">
        <button onClick={onClick}>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    // Held long enough to read: the reader asked what the button does, so the
    // button must not also do it.
    fireEvent.pointerDown(btn, { pointerType: "touch" });
    waitOutDelay(500);
    fireEvent.pointerUp(btn, { pointerType: "touch" });
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();

    // A tap after it is an ordinary tap.
    fireEvent.pointerDown(btn, { pointerType: "touch" });
    waitOutDelay(100);
    fireEvent.pointerUp(btn, { pointerType: "touch" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("gives up the long press when a scroll claims the gesture", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.pointerDown(btn, { pointerType: "touch" });
    waitOutDelay(200);
    fireEvent.pointerCancel(btn, { pointerType: "touch" });
    waitOutDelay(500);

    expect(tooltipNode("Accept")).toBeUndefined();
  });

  it("ignores the mouseenter a tap emits after the finger has gone", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.pointerDown(btn, { pointerType: "touch" });
    waitOutDelay(100);
    fireEvent.pointerUp(btn, { pointerType: "touch" });
    // The compatibility mouse events a touchscreen fires after a tap. No
    // mouseleave follows them, so a tooltip opened here would never close.
    fireEvent.mouseOver(btn);
    waitOutDelay(400);

    expect(tooltipNode("Accept")).toBeUndefined();
  });

  it("leaves a mouse to the hover handlers", () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.mouseOver(btn);
    waitOutDelay();
    expect(tooltipNode("Accept")).toBeDefined();

    // A mouse click has never dismissed the tooltip; the touch path must not
    // have started making it do so.
    fireEvent.pointerDown(btn, { pointerType: "mouse" });
    fireEvent.pointerUp(btn, { pointerType: "mouse" });
    expect(tooltipNode("Accept")).toBeDefined();
  });

  it("still calls the child's own pointer handlers", () => {
    vi.useFakeTimers();
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();
    const { container } = render(
      <Tooltip text="Accept">
        <button onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          Go
        </button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");

    fireEvent.pointerDown(btn, { pointerType: "touch" });
    fireEvent.pointerUp(btn, { pointerType: "touch" });

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
  });

  it("does not measure a trigger that unmounted during the delay", () => {
    vi.useFakeTimers();
    const { container, unmount } = render(
      <Tooltip text="Accept">
        <button>Go</button>
      </Tooltip>,
    );
    const btn = container.querySelector("button");
    const measure = vi.fn(() => ({ bottom: 0, left: 0, width: 0 }));
    btn.getBoundingClientRect = measure;

    fireEvent.mouseOver(btn);
    unmount();
    waitOutDelay();

    expect(measure).not.toHaveBeenCalled();
    expect(tooltipNode("Accept")).toBeUndefined();
  });
});
