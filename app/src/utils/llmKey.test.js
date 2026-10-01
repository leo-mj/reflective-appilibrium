// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  readLLMSettings,
  hasLLMKey,
  notifyLLMKeyChanged,
  requestLLMSettings,
  useHasLLMKey,
  useLLMSettings,
  useLLMSettingsRequested,
} from "./llmKey.js";

const SETTINGS = {
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

function save(settings = SETTINGS) {
  sessionStorage.setItem("llmSettings", JSON.stringify(settings));
}

describe("readLLMSettings", () => {
  beforeEach(() => sessionStorage.clear());

  it("is null when nothing is saved", () => {
    expect(readLLMSettings()).toBeNull();
  });

  it("returns the saved settings", () => {
    save();
    expect(readLLMSettings()).toEqual(SETTINGS);
  });

  it("is null rather than throwing on a malformed value", () => {
    sessionStorage.setItem("llmSettings", "{not json");
    expect(readLLMSettings()).toBeNull();
  });

  // The store is a useSyncExternalStore snapshot, and React compares snapshots
  // by identity: re-parsing on every call would re-render forever.
  it("returns the same object until the stored value changes", () => {
    save();
    expect(readLLMSettings()).toBe(readLLMSettings());
  });

  // The flip side of that cache — a write by anything at all must be seen, so
  // that a request sends the key that is actually saved rather than the one
  // saved when the module loaded.
  it("sees a write that went straight to sessionStorage", () => {
    save();
    save({ ...SETTINGS, model: "gpt-4o-mini" });
    expect(readLLMSettings().model).toBe("gpt-4o-mini");
  });

  it("is null once the key is cleared", () => {
    save();
    readLLMSettings();
    sessionStorage.removeItem("llmSettings");
    expect(readLLMSettings()).toBeNull();
  });
});

describe("hasLLMKey", () => {
  beforeEach(() => sessionStorage.clear());

  it("is false when nothing is saved", () => {
    expect(hasLLMKey()).toBe(false);
  });

  it("is true with a key", () => {
    save();
    expect(hasLLMKey()).toBe(true);
  });

  // What Clear leaves behind if the model is ever written without the key: a
  // settings object that exists but cannot authenticate anything.
  it("is false for settings carrying a model but no key", () => {
    save({ baseUrl: SETTINGS.baseUrl, model: "gpt-4o" });
    expect(hasLLMKey()).toBe(false);
  });
});

// The reason the module exists at all: a save in the modal has to reach the
// header and the assist tabs without a reload, and sessionStorage raises no
// event for a write from the page that made it.
describe("the hooks", () => {
  beforeEach(() => sessionStorage.clear());

  it("useHasLLMKey flips when a key is saved and announced", () => {
    const { result } = renderHook(() => useHasLLMKey());
    expect(result.current).toBe(false);

    act(() => {
      save();
      notifyLLMKeyChanged();
    });
    expect(result.current).toBe(true);

    act(() => {
      sessionStorage.removeItem("llmSettings");
      notifyLLMKeyChanged();
    });
    expect(result.current).toBe(false);
  });

  it("useLLMSettings reports the saved model", () => {
    save();
    const { result } = renderHook(() => useLLMSettings());
    expect(result.current.model).toBe("gpt-4o");

    act(() => {
      save({ ...SETTINGS, model: "gpt-4o-mini" });
      notifyLLMKeyChanged();
    });
    expect(result.current.model).toBe("gpt-4o-mini");
  });

  // A counter rather than a flag, because the second ask has to reopen a modal
  // the reader dismissed after the first — which a boolean already true cannot
  // say.
  it("useLLMSettingsRequested increases once per request", () => {
    const { result } = renderHook(() => useLLMSettingsRequested());
    const before = result.current;

    act(() => requestLLMSettings());
    expect(result.current).toBe(before + 1);

    act(() => requestLLMSettings());
    expect(result.current).toBe(before + 2);
  });
});
