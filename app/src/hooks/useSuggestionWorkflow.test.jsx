// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { useSuggestionWorkflow } from "./useSuggestionWorkflow.js";

afterEach(cleanup);

const aState = { topic: "t", round: 1, elements: [], relations: [] };

describe("useSuggestionWorkflow", () => {
  it("starts with nothing asked for", () => {
    const { result } = renderHook(() => useSuggestionWorkflow(vi.fn()));
    expect(result.current.suggestions).toBeNull();
    expect(result.current.hasResult).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("stores the suggestions and the model that produced them", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ suggestions: [{ text: "a" }], model: "gpt-4o" });
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));

    await act(() => result.current.run(aState));

    expect(result.current.suggestions).toEqual([{ text: "a" }]);
    expect(result.current.model).toBe("gpt-4o");
    expect(result.current.hasResult).toBe(true);
  });

  it("passes the state and the dummy flag through to the client", async () => {
    const fetcher = vi.fn().mockResolvedValue({ suggestions: [], model: "m" });
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));

    await act(() => result.current.run(aState, true));

    expect(fetcher).toHaveBeenCalledWith(aState, true);
  });

  it("an empty result still counts as asked", () => {
    // "No suggestions remaining" and "not asked yet" are different screens.
    const fetcher = vi.fn().mockResolvedValue({ suggestions: [], model: "m" });
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));
    return act(() => result.current.run(aState)).then(() => {
      expect(result.current.hasResult).toBe(true);
      expect(result.current.suggestions).toEqual([]);
    });
  });

  it("reports a failure without clearing what is on screen", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ suggestions: [{ text: "kept" }], model: "m" })
      .mockRejectedValueOnce(new Error("Backend error 500"));
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));

    await act(() => result.current.run(aState));
    await act(() => result.current.run(aState));

    expect(result.current.error).toBe("Backend error 500");
    expect(result.current.suggestions).toEqual([{ text: "kept" }]);
  });

  it("clears a previous error on the next attempt", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ suggestions: [], model: "m" });
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));

    await act(() => result.current.run(aState));
    expect(result.current.error).toBe("boom");

    await act(() => result.current.run(aState));
    expect(result.current.error).toBeNull();
  });

  it("stops loading even when the request fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));

    await act(() => result.current.run(aState));

    expect(result.current.loading).toBe(false);
  });

  it("is loading while the request is in flight", async () => {
    let release;
    const fetcher = vi.fn(
      () => new Promise((resolve) => (release = () => resolve({ suggestions: [], model: "m" }))),
    );
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));

    let pending;
    act(() => {
      pending = result.current.run(aState);
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.loading).toBe(false);
  });

  it("lets the tab remove a suggestion it has dealt with", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ suggestions: [{ id: 1 }, { id: 2 }], model: "m" });
    const { result } = renderHook(() => useSuggestionWorkflow(fetcher));
    await act(() => result.current.run(aState));

    act(() => result.current.setSuggestions((prev) => prev.filter((s) => s.id !== 1)));

    expect(result.current.suggestions).toEqual([{ id: 2 }]);
  });

  it("holds the edit in progress", () => {
    const { result } = renderHook(() => useSuggestionWorkflow(vi.fn()));
    expect(result.current.editing).toBeNull();

    act(() => result.current.setEditing({ draft: "reworded" }));
    expect(result.current.editing).toEqual({ draft: "reworded" });
  });
});
