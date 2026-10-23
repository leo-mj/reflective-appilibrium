// @vitest-environment jsdom
//
// The dialog hands the reader a prompt and takes a map back. It calls no model
// itself, so what is tested is the handover both ways.
import { vi, describe, it, expect, afterEach } from "vitest";
import {
  render,
  fireEvent,
  cleanup,
  screen,
  waitFor,
} from "@testing-library/react";

import { TextImportModal } from "./TextImportModal.jsx";
import { ARGDOWN_IMPORT_PROMPT } from "../../utils/argdownPrompt.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup({ canMerge = false, onSubmit = vi.fn(async () => {}) } = {}) {
  render(
    <TextImportModal
      canMerge={canMerge}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />,
  );
  return onSubmit;
}

const replyBox = () => screen.getByRole("textbox", { name: /Paste the reply/ });
const paste = (text) =>
  fireEvent.change(replyBox(), { target: { value: text } });
const button = (name) => screen.getByRole("button", { name });

describe("TextImportModal", () => {
  it("copies the prompt to the clipboard", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    setup();
    fireEvent.click(button("Copy prompt"));
    await screen.findByText("Copied.");
    expect(writeText).toHaveBeenCalledWith(ARGDOWN_IMPORT_PROMPT);
  });

  it("shows the prompt to copy by hand when the clipboard is out of reach", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => Promise.reject(new Error("no"))),
      },
    });
    setup();
    expect(screen.queryByRole("textbox", { name: "Prompt" })).toBeNull();
    fireEvent.click(button("Copy prompt"));
    await screen.findByText(/Could not reach the clipboard/);
    expect(screen.getByRole("textbox", { name: "Prompt" }).value).toBe(
      ARGDOWN_IMPORT_PROMPT,
    );
  });

  it("imports the map out of a pasted reply", async () => {
    const onSubmit = setup();
    expect(button("Import").disabled).toBe(true);
    paste(
      "Here it is:\n\n```argdown\n===\ntitle: Lying\n===\n\n[A]: Never lie. #principle\n```\n\nNotes.",
    );
    fireEvent.click(button("Import"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [file, mode] = onSubmit.mock.calls[0];
    expect(mode).toBe("import");
    expect(file.name).toBe("Lying.argdown");
    expect(await file.text()).toBe(
      "===\ntitle: Lying\n===\n\n[A]: Never lie. #principle\n",
    );
  });

  it("offers a merge only where one can be made", async () => {
    setup();
    expect(screen.queryByRole("radio")).toBeNull();
    cleanup();

    const onSubmit = setup({ canMerge: true });
    fireEvent.click(
      screen.getByRole("radio", { name: "Merge into this process" }),
    );
    paste("[A]: x");
    fireEvent.click(button("Merge"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][1]).toBe("merge");
  });

  it("keeps the paste and says why when the map cannot be read", async () => {
    setup({
      onSubmit: vi.fn(async () => {
        throw new Error("Argdown syntax error on line 3: …");
      }),
    });
    paste("[A: x");
    fireEvent.click(button("Import"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/line 3/);
    expect(replyBox().value).toBe("[A: x");
    expect(button("Import").disabled).toBe(false);
  });
});
