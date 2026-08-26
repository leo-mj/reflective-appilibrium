// @vitest-environment jsdom
//
// The origin field is filled in once and then left alone. Three forms offer it —
// the add bar under the text panel, an assist tab's own panel, and the graph's
// modal — and each of them used to hold its own copy, reset to "user" by a
// clear, an add, or the unmount a tab change brings. Anyone whose answer was not
// "user" retyped it for every element they added.
//
// So these cover the three ways it could be lost, per surface: an add, a switch
// away and back, and the other surface disagreeing while both are on screen.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import {
  DEFAULT_ORIGIN,
  lastOrigin,
  setLastOrigin,
} from "../../utils/lastOrigin.js";
import { AddElementModal } from "./AddElementModal.jsx";
import { AddBar } from "./TextTabAddPanel.jsx";
import { AddElementPanel } from "./WorkflowAddPanels.jsx";

const ELEMENTS = [
  { id: "J1", type: "judgment", status: "active" },
  { id: "P1", type: "principle", status: "active" },
];

// The store outlives a render, which is the whole point of it — so each test
// puts it back to what a first-time reader would find.
beforeEach(() => setLastOrigin(DEFAULT_ORIGIN));
afterEach(cleanup);

const originField = () => screen.getByLabelText("Origin");
const statement = () => screen.getByPlaceholderText(/Enter statement/);
const type = (value) => fireEvent.change(originField(), { target: { value } });

describe("the add bar", () => {
  const renderBar = (props = {}) =>
    render(
      <AddBar
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
        selected={null}
        ctrlTo={null}
        {...props}
      />,
    );

  it("opens on the default until something else is typed", () => {
    renderBar();
    expect(originField().value).toBe(DEFAULT_ORIGIN);
  });

  it("keeps what was typed across an add", () => {
    const onAddElement = vi.fn();
    renderBar({ onAddElement });
    type("P07");
    fireEvent.change(statement(), { target: { value: "Torturing is wrong." } });
    fireEvent.click(screen.getByRole("button", { name: /^Add / }));

    expect(onAddElement.mock.calls[0][0].origin).toBe("P07");
    // The statement is the element and goes; the origin is who is adding.
    expect(statement().value).toBe("");
    expect(originField().value).toBe("P07");
  });

  it("keeps it across Clear, which is only meant to empty the form", () => {
    renderBar();
    type("P07");
    fireEvent.click(screen.getByRole("button", { name: /^Clear / }));
    expect(originField().value).toBe("P07");
  });

  it("keeps it across the bar being unmounted and put back", () => {
    const { unmount } = renderBar();
    type("P07");
    unmount();
    renderBar();
    expect(originField().value).toBe("P07");
  });

  it("submits the default from a field left empty", () => {
    // Nothing downstream reads a blank origin, so an emptied field is a field
    // being replaced rather than an element with no origin.
    const onAddElement = vi.fn();
    renderBar({ onAddElement });
    type("");
    fireEvent.change(statement(), { target: { value: "Torturing is wrong." } });
    fireEvent.click(screen.getByRole("button", { name: /^Add / }));

    expect(onAddElement.mock.calls[0][0].origin).toBe(DEFAULT_ORIGIN);
    // Still empty on screen: the cursor is in it.
    expect(originField().value).toBe("");
  });
});

describe("an assist tab's add panel", () => {
  const renderPanel = (onAddElement = () => {}) =>
    render(
      <AddElementPanel elementType="judgment" onAddElement={onAddElement} />,
    );

  it("keeps what was typed across an add", () => {
    const onAddElement = vi.fn();
    renderPanel(onAddElement);
    type("gpt-5");
    fireEvent.change(statement(), { target: { value: "Torturing is wrong." } });
    fireEvent.click(screen.getByRole("button", { name: "Add judgment" }));

    expect(onAddElement.mock.calls[0][0]).toMatchObject({
      type: "judgment",
      origin: "gpt-5",
    });
    expect(statement().value).toBe("");
    expect(originField().value).toBe("gpt-5");
  });

  it("opens on what another tab's panel was left on", () => {
    // Switching assist tabs unmounts one panel and mounts another.
    const { unmount } = renderPanel();
    type("gpt-5");
    unmount();
    renderPanel();
    expect(originField().value).toBe("gpt-5");
  });
});

describe("the two surfaces on screen at once", () => {
  it("agree, rather than one going stale under the other", () => {
    render(
      <>
        <AddBar
          elements={ELEMENTS}
          onAddElement={() => {}}
          onAddRelation={() => {}}
          selected={null}
          ctrlTo={null}
        />
        <AddElementPanel elementType="judgment" onAddElement={() => {}} />
      </>,
    );
    const [bar, panel] = screen.getAllByLabelText("Origin");
    fireEvent.change(bar, { target: { value: "P07" } });
    expect(panel.value).toBe("P07");

    fireEvent.change(panel, { target: { value: "P08" } });
    expect(bar.value).toBe("P08");
  });
});

describe("the graph's add modal", () => {
  // Its fields are labelled by a <label> that names no control, so they are
  // reached by position rather than by name — the modal's own gap, and not one
  // this change is about.
  const renderModal = (props = {}) =>
    render(
      <AddElementModal
        initialType="judgment"
        currentRound={1}
        onSave={() => {}}
        onCancel={() => {}}
        {...props}
      />,
    );
  const modalOrigin = (container) =>
    container.querySelector('input[type="text"]');

  it("opens on what the panels were left on", () => {
    setLastOrigin("P07");
    const { container } = renderModal();
    expect(modalOrigin(container).value).toBe("P07");
  });

  it("reports what is typed in it back to the panels", () => {
    const { container } = renderModal();
    fireEvent.change(modalOrigin(container), { target: { value: "P07" } });
    expect(lastOrigin()).toBe("P07");
  });

  it("leaves the origin standing when the form is cleared", () => {
    const { container } = renderModal();
    fireEvent.change(modalOrigin(container), { target: { value: "P07" } });
    fireEvent.change(container.querySelector("textarea"), {
      target: { value: "Torturing is wrong." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Clear/ }));

    expect(modalOrigin(container).value).toBe("P07");
    expect(container.querySelector("textarea").value).toBe("");
  });

  it("saves the default from a field left empty", () => {
    const onSave = vi.fn();
    const { container } = renderModal({ onSave });
    fireEvent.change(modalOrigin(container), { target: { value: "" } });
    fireEvent.change(container.querySelector("textarea"), {
      target: { value: "Torturing is wrong." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave.mock.calls[0][0].origin).toBe(DEFAULT_ORIGIN);
  });
});
