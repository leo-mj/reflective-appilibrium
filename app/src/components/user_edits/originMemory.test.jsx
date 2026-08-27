// @vitest-environment jsdom
//
// The origin field is filled in once and then left alone. Two forms offer it —
// the add bar, which is under every tab, and the graph's modal — and each of
// them used to hold its own copy, reset to "user" by a clear, an add, or the
// unmount a tab change brought. Anyone whose answer was not "user" retyped it
// for every element they added.
//
// So these cover the ways it could be lost, per surface: an add, a move to
// another tab, and the unmount the phone's sheet still brings.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import {
  DEFAULT_ORIGIN,
  lastOrigin,
  setLastOrigin,
} from "../../utils/lastOrigin.js";
import { ADD_BAR_PRESETS } from "../../constants/tabConstants.jsx";
import { AddElementModal } from "./AddElementModal.jsx";
import { AddBar } from "./TextTabAddPanel.jsx";

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
        ctrlChain={null}
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

describe("the bar under an assist tab", () => {
  // The same bar, told by its preset what the tab is about — the assist tabs'
  // own panels are gone. That takes one of the ways the origin could be lost
  // with them: moving between assist tabs is a re-render now rather than an
  // unmount, so the field cannot be reset by a remount. What is left is the
  // add, which empties the form around it and must leave this standing.
  const renderBar = (preset, onAddElement = () => {}) =>
    render(
      <AddBar
        elements={ELEMENTS}
        onAddElement={onAddElement}
        onAddRelation={() => {}}
        selected={null}
        ctrlChain={null}
        preset={preset}
      />,
    );

  it("keeps what was typed across an add", () => {
    const onAddElement = vi.fn();
    renderBar(ADD_BAR_PRESETS.elicitJudgments, onAddElement);
    type("gpt-5");
    fireEvent.change(statement(), { target: { value: "Torturing is wrong." } });
    fireEvent.click(screen.getByRole("button", { name: /^Add / }));

    expect(onAddElement.mock.calls[0][0]).toMatchObject({
      type: "judgment",
      origin: "gpt-5",
    });
    expect(statement().value).toBe("");
    expect(originField().value).toBe("gpt-5");
  });

  it("carries it from one assist tab to the next", () => {
    const { rerender } = renderBar(ADD_BAR_PRESETS.elicitJudgments);
    type("gpt-5");
    rerender(
      <AddBar
        elements={ELEMENTS}
        onAddElement={() => {}}
        onAddRelation={() => {}}
        selected={null}
        ctrlChain={null}
        preset={ADD_BAR_PRESETS.suggestPrinciples}
      />,
    );
    expect(originField().value).toBe("gpt-5");
  });

  it("survives the unmount the phone's sheet brings", () => {
    // Narrow has no strip: the bar comes up as a sheet over the tab and goes
    // again when it is closed, which is where the store still earns its keep.
    const { unmount } = renderBar(ADD_BAR_PRESETS.elicitJudgments);
    type("gpt-5");
    unmount();
    renderBar(ADD_BAR_PRESETS.suggestTheories);
    expect(originField().value).toBe("gpt-5");
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
