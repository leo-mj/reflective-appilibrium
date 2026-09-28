// @vitest-environment jsdom
//
// The header's settings and privacy modals are their own markup rather than
// ModalShell, and so went without what ModalShell gives a keyboard: none was
// announced as a modal dialog, none took the focus, and Escape did nothing.
// Tested as the header uses them — always mounted, shown by `open`.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";

import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { PrivacyModal } from "./PrivacyModal.jsx";
import { FontSettingsModal } from "./FontSettingsModal.jsx";
import { useMenuEscape } from "../../hooks/useMenuEscape.js";

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

  // The item that opened it went with the menu, so the focus used to land on
  // <body>, and the next Tab started from the top of the page.
  it("gives the focus to ☰ when the menu item that opened it is gone", () => {
    render(<Header Modal={Modal} />);
    const burger = screen.getByRole("button", { name: "☰" });
    fireEvent.click(burger);
    const item = screen.getByRole("menuitem");
    item.focus();
    fireEvent.click(item);
    expect(screen.queryByRole("menuitem")).toBeNull();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(burger);
  });
});

/**
 * The header's arrangement: ☰, a menu whose item closes the menu and opens the
 * modal in one press, and an app-wide Escape that lets go of the selection
 * unless the key was already handled — REState's, in miniature.
 */
function Header({ Modal = PrivacyModal, onAppEscape = () => {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const burger = useRef(null);
  useMenuEscape({ open: menuOpen, onClose: () => setMenuOpen(false), buttonRef: burger });
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) onAppEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onAppEscape]);
  return (
    <>
      <button ref={burger} onClick={() => setMenuOpen((o) => !o)}>
        ☰
      </button>
      {menuOpen && (
        <div>
          <button
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setModalOpen(true);
            }}
          >
            Item
          </button>
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} returnFocusTo={burger} />
    </>
  );
}

describe("the ☰ menu", () => {
  it("closes on Escape and leaves the focus on ☰", () => {
    render(<Header />);
    const burger = screen.getByRole("button", { name: "☰" });
    fireEvent.click(burger);
    screen.getByRole("menuitem").focus();

    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(document.activeElement).toBe(burger);
  });

  it("closes on Escape when nothing inside it has the focus", () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "☰" }));
    document.body.focus();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  // One press, one thing: closing the menu must not also clear the selection.
  it("keeps that Escape from the app's own", () => {
    const onAppEscape = vi.fn();
    render(<Header onAppEscape={onAppEscape} />);
    fireEvent.click(screen.getByRole("button", { name: "☰" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onAppEscape).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onAppEscape).toHaveBeenCalledTimes(1);
  });
});
