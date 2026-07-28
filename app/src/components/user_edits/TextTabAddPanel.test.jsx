// @vitest-environment jsdom
//
// A graph selection pre-fills the relation form. That adjustment happens during
// render rather than in an effect, so these tests cover the cases where the two
// differ: a selection already present at mount, and a selection that is cleared
// and then re-made with the same id.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { AddBar } from "./TextTabAddPanel.jsx";

afterEach(cleanup);

const ELEMENTS = [
  { id: "J1", type: "judgment", status: "active" },
  { id: "J2", type: "judgment", status: "active" },
  { id: "P1", type: "principle", status: "active" },
];

function renderBar(props = {}) {
  return render(
    <AddBar
      elements={ELEMENTS}
      onAddElement={() => {}}
      onAddRelation={() => {}}
      selected={null}
      ctrlTo={null}
      {...props}
    />,
  );
}

/** "element" or "relation", read off the textarea placeholder. */
function activeTab(container) {
  const placeholder = container.querySelector("textarea").placeholder;
  return placeholder.startsWith("Enter statement") ? "element" : "relation";
}

/** The from/to select values, in document order. */
function relationEndpoints(container) {
  const selects = [...container.querySelectorAll("select")];
  return { from: selects[0].value, to: selects[2].value };
}

describe("AddBar graph-selection sync", () => {
  it("starts on the element tab with nothing selected", () => {
    const { container } = renderBar();
    expect(activeTab(container)).toBe("element");
  });

  it("switches to the relation tab and fills 'from' when a node is selected", () => {
    const { container, rerender } = renderBar();
    rerender(
      <AddBar
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
        selected="J2"
        ctrlTo={null}
      />,
    );
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container).from).toBe("J2");
  });

  it("picks up a selection that is already present on mount", () => {
    const { container } = renderBar({ selected: "P1" });
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container).from).toBe("P1");
  });

  it("fills 'to' from a ctrl-selected second node", () => {
    const { container } = renderBar({ selected: "J1", ctrlTo: "P1" });
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container)).toEqual({ from: "J1", to: "P1" });
  });

  it("re-applies the same id after the selection is cleared", () => {
    const props = {
      elements: ELEMENTS,
      onAddElement: () => {},
      onAddRelation: () => {},
      ctrlTo: null,
    };
    const { container, rerender } = renderBar({ selected: "J2" });
    expect(relationEndpoints(container).from).toBe("J2");

    // Back to the element tab by hand, selection cleared, then J2 again: the
    // panel must react even though the id has not changed since last time.
    rerender(<AddBar {...props} selected={null} />);
    rerender(<AddBar {...props} selected="J1" />);
    expect(relationEndpoints(container).from).toBe("J1");

    rerender(<AddBar {...props} selected={null} />);
    expect(activeTab(container)).toBe("relation");

    rerender(<AddBar {...props} selected="J1" />);
    expect(relationEndpoints(container).from).toBe("J1");
  });

  it("leaves the tab alone when the selection is cleared", () => {
    const props = {
      elements: ELEMENTS,
      onAddElement: () => {},
      onAddRelation: () => {},
      ctrlTo: null,
    };
    const { container, rerender } = renderBar({ selected: "J2" });
    rerender(<AddBar {...props} selected={null} />);
    expect(activeTab(container)).toBe("relation");
    expect(relationEndpoints(container).from).toBe("J2");
  });
});
