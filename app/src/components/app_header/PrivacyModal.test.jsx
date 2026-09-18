// @vitest-environment jsdom
//
// A privacy statement that is wrong in the reassuring direction is worse than
// none. Each sentence here depends on the build and the server actually in use,
// so these pin that the wording follows them: no claims about a server in the
// demo, and no "nothing on disk" before the server has said so.
import { vi, describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const flags = vi.hoisted(() => ({
  backend: true,
  capabilities: { loaded: true, reachable: true, sessions: false, maxElements: 0 },
}));
vi.mock("../../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKEND_ENABLED() {
    return flags.backend;
  },
}));
vi.mock("../../hooks/useBackendCapabilities.js", () => ({
  useBackendCapabilities: () => flags.capabilities,
}));

import { PrivacyModal } from "./PrivacyModal.jsx";

afterEach(() => {
  cleanup();
  flags.backend = true;
  flags.capabilities = { loaded: true, reachable: true, sessions: false, maxElements: 0 };
});

const text = () => {
  render(<PrivacyModal open onClose={() => {}} />);
  return document.body.textContent;
};

describe("in the demo build", () => {
  it("says nothing leaves the browser, and nothing about a server or a key", () => {
    flags.backend = false;
    const t = text();
    expect(t).toContain("Nothing leaves this browser");
    expect(t).not.toMatch(/API key|Crossref|provider/);
  });
});

describe("with a backend", () => {
  it("says where the key goes and that the server does not keep it", () => {
    expect(text()).toContain("does not store it or log it");
  });

  it("does not promise the key is gone when the tab closes", () => {
    // Browsers restore sessionStorage with a reopened tab or session.
    const t = text();
    expect(t).not.toContain("forgotten when the tab closes");
    expect(t).toContain("reopening a closed tab");
    expect(t).toContain("press Clear");
  });

  it("advises a key with a spending limit", () => {
    expect(text()).toContain("spending limit");
  });

  it("names the provider and Crossref as the places reasoning can go", () => {
    const t = text();
    expect(t).toContain("provider");
    expect(t).toContain("Crossref");
  });

  it("says nothing is written to disk when sessions are off", () => {
    const t = text();
    expect(t).toContain("Nothing on disk");
  });

  it("does not say a discussion is held on the server", () => {
    // routers/conversations.py keeps nothing between turns.
    const t = text();
    expect(t).not.toMatch(/memory|minutes/);
    expect(t).toContain("A discussion is not kept");
  });

  it("says saved sessions are written to disk when they are on", () => {
    flags.capabilities = { ...flags.capabilities, sessions: true };
    const t = text();
    expect(t).toContain("written to its disk");
    expect(t).not.toContain("Nothing on disk");
  });

  it("claims nothing about retention before the server has answered", () => {
    flags.capabilities = { loaded: false, reachable: false, sessions: false, maxElements: 0 };
    const t = text();
    expect(t).toContain("Checking what this server keeps");
    expect(t).not.toContain("Nothing on disk");
  });

  it("claims nothing about retention when the server cannot be reached", () => {
    flags.capabilities = { loaded: true, reachable: false, sessions: false, maxElements: 0 };
    const t = text();
    expect(t).toContain("could not be checked");
    expect(t).not.toContain("Nothing on disk");
  });
});

it("mentions the autosaved draft in every build", () => {
  for (const backend of [true, false]) {
    flags.backend = backend;
    expect(text()).toContain("autosaved in this browser");
    cleanup();
  }
});
