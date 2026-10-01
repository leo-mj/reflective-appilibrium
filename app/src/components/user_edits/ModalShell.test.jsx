// @vitest-environment jsdom
//
// Every add, edit and withdraw form is this shell, so whether it works by
// keyboard is whether any of them does.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { useState } from "react";

import { ModalShell } from "./ModalShell.jsx";

afterEach(cleanup);

/** A button that opens the dialog, as Revise does. */
function Opener({ onCancel = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Revise</button>
      {open && (
        <ModalShell
          title="Revise J1"
          subtitle="Change the wording."
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
          onSave={() => setOpen(false)}
        >
          <textarea aria-label="Wording" />
        </ModalShell>
      )}
    </>
  );
}

describe("ModalShell, by keyboard", () => {
  it("is a dialog, named by its title", () => {
    render(<Opener />);
    fireEvent.click(screen.getByText("Revise"));
    expect(screen.getByRole("dialog", { name: "Revise J1" })).toBeDefined();
  });

  it("takes the focus when it opens, and gives it back when it closes", () => {
    render(<Opener />);
    const opener = screen.getByText("Revise");
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByLabelText("Wording")).toBe(document.activeElement);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(opener).toBe(document.activeElement);
  });

  it("closes on Escape", () => {
    const onCancel = vi.fn();
    render(<Opener onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Revise"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Keeping Tab inside is e2e/a11y.spec.js's to check: jsdom lays nothing
  // out, and a trap tested without layout passes whatever it does.
});
