import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
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
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
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
