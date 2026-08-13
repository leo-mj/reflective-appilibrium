// @vitest-environment jsdom
import { StrictMode } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAutosaveDraft } from "./useAutosaveDraft.js";
import { loadDraft } from "../utils/draftStorage.js";

const aState = (overrides = {}) => ({
  topic: "Autonomy",
  phase: 2,
  round: 1,
  elements: [],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  // Explicit: this project does not enable vitest globals, so Testing Library's
  // automatic cleanup never registers. Without it a hook stays mounted into the
  // next test, still listening for pagehide and still writing drafts.
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useAutosaveDraft", () => {
  it("does not write immediately", () => {
    renderHook(() => useAutosaveDraft(aState()));
    expect(loadDraft()).toBeNull();
  });

  it("writes once the state has settled", () => {
    renderHook(() => useAutosaveDraft(aState({ topic: "Settled" })));
    act(() => vi.advanceTimersByTime(1000));
    expect(loadDraft().state.topic).toBe("Settled");
  });

  it("only writes the last of a burst of changes", () => {
    // Dragging a slider produces a burst; serialising the graph on each one
    // would be felt.
    const spy = vi.spyOn(Storage.prototype, "setItem");
    const { rerender } = renderHook(({ s }) => useAutosaveDraft(s), {
      initialProps: { s: aState({ round: 1 }) },
    });
    for (let round = 2; round <= 6; round++) {
      rerender({ s: aState({ round }) });
      act(() => vi.advanceTimersByTime(100));
    }
    expect(spy).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loadDraft().state.round).toBe(6);
    spy.mockRestore();
  });

  it("writes nothing when disabled", () => {
    // The sample process is a fixed demonstration; autosaving it would bury the
    // visitor's own work.
    renderHook(() => useAutosaveDraft(aState(), false));
    act(() => vi.advanceTimersByTime(5000));
    expect(loadDraft()).toBeNull();
  });

  it("flushes on unmount, before the debounce would have fired", () => {
    const { unmount } = renderHook(() =>
      useAutosaveDraft(aState({ topic: "Leaving" })),
    );
    unmount();
    expect(loadDraft().state.topic).toBe("Leaving");
  });

  it("flushes when the page is hidden", () => {
    // pagehide, not beforeunload: on mobile a backgrounded tab can be discarded
    // without beforeunload ever running.
    renderHook(() => useAutosaveDraft(aState({ topic: "Backgrounded" })));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(loadDraft().state.topic).toBe("Backgrounded");
  });

  it("stops listening after unmount", () => {
    const { unmount } = renderHook(() =>
      useAutosaveDraft(aState({ topic: "Gone" })),
    );
    unmount();
    localStorage.clear();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(loadDraft()).toBeNull();
  });

  it("works under StrictMode", () => {
    // Effects are mounted, torn down and remounted; the listener must survive
    // that rather than be removed by the first teardown.
    renderHook(() => useAutosaveDraft(aState({ topic: "Strict" })), {
      wrapper: StrictMode,
    });
    localStorage.clear();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(loadDraft().state.topic).toBe("Strict");
  });
});
