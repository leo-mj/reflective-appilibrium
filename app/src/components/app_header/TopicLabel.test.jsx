// @vitest-environment jsdom
//
// The topic is the question the whole process is about. Where there is room to
// show it in full it should be shown in full; the ellipsis-and-tooltip
// treatment is for the wide header, where it has to share a row.
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { TopicLabel } from "./TopicLabel.jsx";

afterEach(cleanup);

const TOPIC = "Do we have moral obligations to people who do not yet exist?";

/** The element holding the topic text, i.e. the child of the wrapper. */
const body = (container) => container.firstChild.firstChild;

describe("wrapped", () => {
  it("shows the topic over as many lines as it takes", () => {
    const { container } = render(<TopicLabel topic={TOPIC} wrap />);
    expect(body(container).style.textOverflow).toBe("");
    expect(body(container).style.whiteSpace).toBe("");
    expect(container.textContent).toBe(TOPIC);
  });

  it("does not also open a tooltip repeating it", () => {
    const { container } = render(<TopicLabel topic={TOPIC} wrap />);
    fireEvent.mouseEnter(container.firstChild);
    expect(container.textContent).toBe(TOPIC);
  });
});

describe("clamped", () => {
  it("truncates to one line", () => {
    const { container } = render(<TopicLabel topic={TOPIC} />);
    expect(body(container).style.textOverflow).toBe("ellipsis");
    expect(body(container).style.whiteSpace).toBe("nowrap");
  });

  it("reveals the rest on hover, since the text is cut off", () => {
    const { container } = render(<TopicLabel topic={TOPIC} />);
    fireEvent.mouseEnter(container.firstChild);
    // Once in the clamped line, once in the tooltip.
    expect(container.textContent).toBe(TOPIC + TOPIC);
  });
});
