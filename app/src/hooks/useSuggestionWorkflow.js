/**
 * @fileoverview The state every suggestion tab keeps while asking the LLM for
 * suggestions and letting the user work through them.
 * @module hooks/useSuggestionWorkflow
 */

import { useState } from "react";

/**
 * Holds one round of suggestions and the request that produced them.
 *
 * The three suggestion tabs each kept these same five pieces of state and the
 * same fetch-and-store function, differing only in which client they called.
 * What they do *with* a suggestion still differs — a judgment is one option
 * among several inside a question, a relation edits its explanation rather than
 * its text — so accepting and rejecting stay in the tabs.
 *
 * @param {Function} fetcher  A makeLLMClient function: (state, useDummy) =>
 *   Promise<{suggestions, model}>.
 * @returns {{
 *   suggestions: Array|null, setSuggestions: Function,
 *   loading: boolean, error: string|null, model: string|null,
 *   editing: Object|null, setEditing: Function,
 *   hasResult: boolean, run: Function,
 * }}
 */
export function useSuggestionWorkflow(fetcher) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  /** The suggestion being edited and its draft text, or null. */
  const [editing, setEditing] = useState(null);

  /**
   * Ask for a fresh set of suggestions, replacing whatever is on screen.
   *
   * @param {Object}  state
   * @param {boolean} useDummy  Serve the sample fixtures instead of calling out.
   */
  const run = async (state, useDummy = false) => {
    setLoading(true);
    setError(null);
    try {
      const { suggestions: s, model: m } = await fetcher(state, useDummy);
      setSuggestions(s);
      setModel(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    suggestions,
    setSuggestions,
    loading,
    error,
    model,
    editing,
    setEditing,
    // `null` means "not asked yet", which is what distinguishes a fresh tab
    // from one whose suggestions have all been dealt with.
    hasResult: suggestions !== null,
    run,
  };
}
