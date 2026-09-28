/**
 * @fileoverview Whether an assist tab's suggestions are the recorded samples.
 * @module components/sampleSuggestions
 */

import { createContext } from "react";

/**
 * Given by GraphPanel, which decides it once for every tab. Only the demo
 * process gets samples, so in a reader's own process it is false, and the key
 * notice asks for a key rather than describing samples that are not there.
 * True by default, which is what a tab rendered on its own — in a test — has
 * always shown.
 */
export const SampleSuggestionsContext = createContext(true);
