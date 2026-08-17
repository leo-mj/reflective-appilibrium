/**
 * @fileoverview What every ☰ menu row is called, and the one line each of them
 * gets on hover.
 *
 * Shared by both header layouts so the wide bar and the narrow menu cannot
 * drift apart on what a setting is named — they are two views of one menu.
 *
 * Tooltips are one short sentence. They are read in a small box beside the
 * cursor, not on a help page: the long ones wrapped into a column of single
 * words and were skipped rather than read.
 *
 * @module components/app_header/menuText
 */

/** Row labels. Fixed: a toggle says what it *is*, its switch says whether it is on. */
export const MENU_LABELS = {
  home: "Home",
  llm: "LLM settings",
  weights: "Model weights",
  relations: "All relations",
  checker: "Argument checker",
  font: "Select Font",
  theme: "Dark mode",
  contrast: "High-contrast",
  navBar: "Section nav bar",
  cards: "Expanded cards",
  import: "Import",
  export: "Export",
  save: "Save",
};

/** One line each, keyed as above. */
export const MENU_TOOLTIPS = {
  home: "Back to the start screen. Unsaved work is lost.",
  llm: "Your provider, model and API key.",
  weights: "What the rethon simulation optimises for.",
  relations: "Adds supports, conflicts, undermines and depends.",
  checker: "Detected arguments are tested for validity first.",
  font: "Includes a face drawn for dyslexic readers.",
  theme: "Dark or light background.",
  contrast: "Stronger node colours, AAA throughout.",
  navBar: "Section links and search, in the text panel.",
  cards: "Every card in the text panel, open or closed.",
  import: "Read a state back from a file.",
  export: "Write the whole process out to a file.",
  save: "Store this session on the server.",
};

/** Headings over the menu's blocks, in the order they appear. */
export const MENU_HEADINGS = {
  content: "Content",
  model: "Model",
  appearance: "Appearance",
  text: "Text panel",
  session: "Session",
};
