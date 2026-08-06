// @vitest-environment jsdom
//
// A graph selection pre-fills the link forms. That adjustment happens during
// render rather than in an effect, so these tests cover the cases where the two
// differ: a selection already present at mount, and a selection that is cleared
// and then re-made with the same id.
//
// The rest is what the bar offers: arguments in place of relations wherever the
// graph is showing arguments only, and arguments of more than one premise.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

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

/** The tab on show, read off the textarea placeholder. */
function activeTab(container) {
  const placeholder = container.querySelector("textarea").placeholder;
  if (placeholder.startsWith("Enter statement")) return "element";
  return placeholder.startsWith("Why do these premises")
    ? "argument"
    : "relation";
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

describe("what the bar offers", () => {
  it("offers relations only where the graph would show them", () => {
    renderBar({ hideNonEntailsRels: false });
    expect(screen.queryByText("Relation")).toBeTruthy();
    expect(screen.queryByText("Argument")).toBeTruthy();

    cleanup();
    // Arguments-only view: a supports or conflicts relation added here would
    // vanish the moment it was made.
    renderBar({ hideNonEntailsRels: true });
    expect(screen.queryByText("Relation")).toBeNull();
    expect(screen.queryByText("Argument")).toBeTruthy();
  });

  it("sends a graph selection to the argument tab when relations are hidden", () => {
    const { container } = renderBar({
      hideNonEntailsRels: true,
      selected: "J2",
      ctrlTo: "P1",
    });
    expect(activeTab(container)).toBe("argument");
    expect(screen.getByLabelText("Premise 1").value).toBe("J2");
    expect(screen.getByLabelText("Conclusion").value).toBe("P1");
  });

  it("keeps the reader on the argument tab when the setting flips under them", () => {
    const props = {
      elements: ELEMENTS,
      onAddElement: () => {},
      onAddRelation: () => {},
      selected: null,
      ctrlTo: null,
    };
    const { container, rerender } = renderBar({ hideNonEntailsRels: false });
    fireEvent.click(screen.getByText("Relation"));
    expect(activeTab(container)).toBe("relation");

    rerender(<AddBar {...props} hideNonEntailsRels />);
    expect(activeTab(container)).toBe("argument");
    // …and back again, rather than having been thrown off the tab for good.
    rerender(<AddBar {...props} hideNonEntailsRels={false} />);
    expect(activeTab(container)).toBe("relation");
  });
});

describe("adding an argument", () => {
  const addArgument = (onAddRelation, premiseIds) => {
    renderBar({ hideNonEntailsRels: true, onAddRelation });
    fireEvent.click(screen.getByText("Argument"));
    premiseIds
      .slice(1)
      .forEach(() => fireEvent.click(screen.getByText("+ premise")));
    premiseIds.forEach((id, i) =>
      fireEvent.change(screen.getByLabelText(`Premise ${i + 1}`), {
        target: { value: id },
      }),
    );
    fireEvent.change(screen.getByLabelText("Conclusion"), {
      target: { value: "P1" },
    });
    fireEvent.click(screen.getByText(/^Add argument$/));
  };

  it("writes one relation per premise, grouped as a single argument", () => {
    // The shared argumentId is what makes the graph draw them converging on one
    // arrow, and what lets the argument be selected or deleted as a whole.
    const onAddRelation = vi.fn();
    addArgument(onAddRelation, ["J1", "J2"]);

    expect(onAddRelation).toHaveBeenCalledTimes(2);
    const [first, second] = onAddRelation.mock.calls.map(([rel]) => rel);
    expect(first.argumentId).toBe(second.argumentId);
    expect([first.from, second.from]).toEqual(["J1", "J2"]);
    expect([first.to, second.to]).toEqual(["P1", "P1"]);
    // Two premises make it a joint entailment; one would be a plain one.
    expect(first.type).toBe("jointly_entails");
  });

  it("stays a plain entailment with a single premise", () => {
    const onAddRelation = vi.fn();
    addArgument(onAddRelation, ["J1"]);
    expect(onAddRelation).toHaveBeenCalledTimes(1);
    expect(onAddRelation.mock.calls[0][0].type).toBe("entails");
  });

  it("will not add one whose conclusion is also a premise", () => {
    renderBar({ hideNonEntailsRels: true });
    fireEvent.click(screen.getByText("Argument"));
    fireEvent.change(screen.getByLabelText("Premise 1"), {
      target: { value: "P1" },
    });
    fireEvent.change(screen.getByLabelText("Conclusion"), {
      target: { value: "P1" },
    });
    expect(screen.getByText(/^Add argument$/).disabled).toBe(true);
    expect(screen.queryByText("Premise ≠ conclusion")).toBeTruthy();
  });
});
