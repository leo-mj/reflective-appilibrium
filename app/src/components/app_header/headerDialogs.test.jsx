// @vitest-environment jsdom
//
// The header's settings and privacy modals are their own markup rather than
// ModalShell, and so went without what ModalShell gives a keyboard: none was
// announced as a modal dialog, none took the focus, and Escape did nothing.
// Tested as the header uses them — always mounted, shown by `open`.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";

import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { PrivacyModal } from "./PrivacyModal.jsx";
import { FontSettingsModal } from "./FontSettingsModal.jsx";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A menu item that opens the modal, as the header's do. */
function Opener({ Modal }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const MODALS = [
  ["LLM settings", LLMSettingsModal, "LLM Settings"],
  ["Privacy", PrivacyModal, "Where your data goes"],
  ["Font", FontSettingsModal, "Font"],
];

describe.each(MODALS)("the %s modal", (_, Modal, title) => {
  it("is a modal dialog, named by its title", () => {
    render(<Opener Modal={Modal} />);
    fireEvent.click(screen.getByText("Open"));
    const dialog = screen.getByRole("dialog", { name: title });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("takes the focus, closes on Escape, and gives the focus back", () => {
    render(<Opener Modal={Modal} />);
    const opener = screen.getByText("Open");
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("takes the focus again when reopened", () => {
    render(<Opener Modal={Modal} />);
    const opener = screen.getByText("Open");
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(opener);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});
