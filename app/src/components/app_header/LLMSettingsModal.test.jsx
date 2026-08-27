// @vitest-environment jsdom
//
// The demo build shows this modal so visitors can see what configuring a
// provider involves, but there is no backend to relay a key to. Anything that
// would reach the network, or bank a key for a request that cannot be made,
// has to be inert — and visibly so, or the form is a trap.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const flags = vi.hoisted(() => ({ byok: false }));
vi.mock("../../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  get BYOK_ENABLED() {
    return flags.byok;
  },
}));

import { LLMSettingsModal } from "./LLMSettingsModal.jsx";

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ base_urls: [] }) }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  flags.byok = false;
});

const open = () => render(<LLMSettingsModal open onClose={() => {}} />);
const button = (label) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
const keyField = () => document.querySelector('input[type="password"]');

describe("in the demo build", () => {
  it("says so, rather than letting the form look live", () => {
    open();
    expect(screen.getByText(/Demo only/)).toBeTruthy();
    expect(document.body.textContent).toContain("no key can be sent");
  });

  it("shows the API key field but does not accept a key", () => {
    open();
    expect(keyField()).toBeTruthy();
    expect(keyField().disabled).toBe(true);
  });

  it("disables testing and saving, with the reason on hover", () => {
    open();
    for (const label of ["Test connection", "Save"]) {
      expect(button(label).disabled, label).toBe(true);
      expect(button(label).title, label).toContain("demo");
    }
  });

  it("asks the backend for nothing on open", () => {
    open();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("banks no key, since Save cannot be reached", () => {
    open();
    fireEvent.click(button("Save"));
    expect(sessionStorage.getItem("llmSettings")).toBeNull();
  });
});

describe("when BYOK is available", () => {
  beforeEach(() => {
    flags.byok = true;
  });

  it("drops the demo notice", () => {
    open();
    expect(screen.queryByText(/Demo only/)).toBeNull();
  });

  it("accepts a key", () => {
    open();
    expect(keyField().disabled).toBe(false);
    fireEvent.change(keyField(), { target: { value: "sk-test" } });
    expect(keyField().value).toBe("sk-test");
  });

  it("allows a connection test", () => {
    open();
    expect(button("Test connection").disabled).toBe(false);
  });

  it("looks up which providers the server already has keys for", () => {
    open();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/llm/configured-providers");
  });
});
