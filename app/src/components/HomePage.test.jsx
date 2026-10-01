// @vitest-environment jsdom
//
// There is one draft slot, and a new process's first autosave writes over it.
// Start used to begin that process unasked, with the draft it was about to lose
// on offer in the card beside it.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../utils/exportMarkdown.js", async (importOriginal) => ({
  ...(await importOriginal()),
  downloadMarkdown: vi.fn(),
}));

import { HomePage } from "./HomePage.jsx";
import { SAMPLE_STATE } from "../state.js";
import { loadDraft, saveDraft } from "../utils/draftStorage.js";
import { buildMarkdown, downloadMarkdown } from "../utils/exportMarkdown.js";

let onStartFresh;

beforeEach(() => {
  onStartFresh = vi.fn();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

const renderHome = () =>
  render(
    <HomePage
      onStartFresh={onStartFresh}
      onLoadSample={() => {}}
      onLoadQuestionnaire={() => {}}
      onLoadSession={() => {}}
    />,
  );

const withDraft = () =>
  saveDraft({ ...SAMPLE_STATE, topic: "First process" });

function start(topic = "Second process") {
  fireEvent.change(
    screen.getByLabelText("Topic of your reflective equilibrium process"),
    { target: { value: topic } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
}

const dialog = () => screen.queryByRole("dialog");

describe("starting a new process", () => {
  it("goes straight in when there is no draft to lose", () => {
    renderHome();
    start();
    expect(dialog()).toBeNull();
    expect(onStartFresh).toHaveBeenCalledWith("Second process");
  });

  it("asks first when a draft is on offer, naming both processes", () => {
    withDraft();
    renderHome();
    start();
    expect(onStartFresh).not.toHaveBeenCalled();
    expect(dialog().textContent).toContain("Second process");
    expect(dialog().textContent).toContain("First process");
    expect(dialog().textContent).toContain(`round 8, step ${SAMPLE_STATE.round}`);
  });

  it("asks on Ctrl+Enter in the topic field too", () => {
    withDraft();
    renderHome();
    const field = screen.getByLabelText("Topic of your reflective equilibrium process");
    fireEvent.change(field, { target: { value: "Second process" } });
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    expect(dialog()).not.toBeNull();
    expect(onStartFresh).not.toHaveBeenCalled();
  });

  it("leaves the draft untouched on Cancel", () => {
    withDraft();
    renderHome();
    start();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog()).toBeNull();
    expect(onStartFresh).not.toHaveBeenCalled();
    expect(loadDraft().state.topic).toBe("First process");
    expect(screen.getByText("Continue where you left off")).toBeTruthy();
  });

  it("leaves it untouched on Escape", () => {
    withDraft();
    renderHome();
    start();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(onStartFresh).not.toHaveBeenCalled();
  });

  it("starts the new process on Replace", () => {
    withDraft();
    renderHome();
    start();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(onStartFresh).toHaveBeenCalledWith("Second process");
  });

  it("does not ask once the draft has been discarded", () => {
    withDraft();
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    start();
    expect(dialog()).toBeNull();
    expect(onStartFresh).toHaveBeenCalledWith("Second process");
  });

  it("opens on Export rather than Replace, so a stray Enter loses nothing", () => {
    withDraft();
    renderHome();
    start();
    expect(document.activeElement.textContent).toBe("Export it first");
  });
});

describe("exporting the draft from the dialog", () => {
  it("downloads the draft with its full history, and stays open", () => {
    withDraft();
    renderHome();
    start();
    fireEvent.click(screen.getByRole("button", { name: "Export it first" }));

    expect(downloadMarkdown).toHaveBeenCalledTimes(1);
    const [state, , sections] = downloadMarkdown.mock.calls[0];
    expect(state.topic).toBe("First process");
    expect(sections.has("history")).toBe(true);
    expect(dialog().textContent).toContain("Exported");
    expect(onStartFresh).not.toHaveBeenCalled();
  });

  it("writes a file Import can read without a graph layout", () => {
    withDraft();
    renderHome();
    start();
    fireEvent.click(screen.getByRole("button", { name: "Export it first" }));

    const [state, positions, sections] = downloadMarkdown.mock.calls[0];
    // The graph and cluster images need positions, which the landing page has none of.
    expect(sections.has("graph")).toBe(false);
    expect(sections.has("clusters")).toBe(false);
    const markdown = buildMarkdown(state, positions, sections);
    expect(markdown).toContain("```re-state");
    expect(markdown).toContain("## Elements");
  });
});
