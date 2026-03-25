/**
 * @fileoverview Shared React context for the TextTab component tree.
 * Imported by TextTab.jsx (provider) and all sub-components (consumers).
 * Kept in its own file to avoid circular dependencies.
 * @module components/TextTabContext
 */

import { createContext } from "react";

/** Shared values threaded to all TextTab sub-components without prop drilling. */
export const Ctx = createContext(null);
