import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: { react },
    rules: {
      // Base no-unused-vars does not understand JSX: a component referenced only
      // as <Thing /> looks unused to it. That is why the ignore pattern here was
      // `^[A-Z_]` — broad enough to cover every component, and so broad that it
      // also hid genuinely dead imports (two sat unnoticed in the workflow tabs).
      //
      // This rule is the proper fix: it marks anything used in JSX as used, so
      // the ignore pattern can shrink to `^_`, the conventional deliberate-unused
      // marker, which exempts nothing by accident.
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["error", { varsIgnorePattern: "^_" }],
      // Dev-only hot-reload granularity: a module that exports both a component
      // and a constant costs a full reload instead of a refresh, and nothing in
      // production. Worth knowing about, not worth failing CI over.
      "react-refresh/only-export-components": "warn",
    },
  },
  {
    // Build config runs in Node, not the browser: it reads process.env to
    // derive the GitHub Pages base path from the repo name.
    files: ["vite.config.js"],
    languageOptions: { globals: globals.node },
  },
]);
